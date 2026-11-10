"""Real REST and WebSocket chat regressions with an isolated SQLite database."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from chat_test_server import create_test_app
from fastapi.testclient import TestClient

from app.core.rate_limit import limiter


@pytest.fixture
def client(tmp_path: Path):
    limiter.reset()
    with TestClient(create_test_app(tmp_path)) as client:
        yield client


def account(client, name):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": name + "@example.com",
            "password": "ChatPassword123",
            "full_name": name,
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    headers = {"Authorization": "Bearer " + token}
    profile = client.get("/api/v1/auth/me", headers=headers).json()
    return headers, profile, token


def direct(client, headers, username):
    response = client.post(
        "/api/v1/chat/conversations",
        headers=headers,
        json={"kind": "direct", "usernames": ["@" + username]},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_handles_search_and_direct_identity(client):
    alice, a, _ = account(client, "alice")
    bob, b, _ = account(client, "bob")
    assert a["username"] and b["username"] and a["username"] != b["username"]
    changed = client.put("/api/v1/auth/username", headers=bob, json={"username": "@Study_Bob"})
    assert changed.status_code == 200 and changed.json()["username"] == "study_bob"
    assert (
        client.put(
            "/api/v1/auth/username", headers=alice, json={"username": "STUDY_BOB"}
        ).status_code
        == 409
    )
    assert (
        client.get("/api/v1/chat/users?q=@study_b", headers=alice).json()[0]["username"]
        == "study_bob"
    )
    assert (
        client.get("/api/v1/chat/users?q=@study_", headers=alice).json()[0]["username"]
        == "study_bob"
    )
    assert client.get("/api/v1/chat/users?q=@study%", headers=alice).json() == []
    assert client.get("/api/v1/chat/users?q=bob@example.com", headers=alice).json() == []
    assert (
        client.post(
            "/api/v1/chat/conversations",
            headers=alice,
            json={"kind": "direct", "usernames": ["@study"]},
        ).status_code
        == 400
    )
    conversation = direct(client, alice, "STUDY_BOB")
    assert direct(client, bob, a["username"]) == conversation
    assert (
        client.delete(
            "/api/v1/chat/conversations/" + conversation + "/members/me", headers=alice
        ).status_code
        == 400
    )
    assert direct(client, alice, "study_bob") == conversation


def test_message_receipts_attachments_and_membership(client):
    alice, _, _ = account(client, "alice")
    bob, b, _ = account(client, "bob")
    outsider, _, _ = account(client, "eve")
    conversation = direct(client, alice, b["username"])
    base = "/api/v1/chat/conversations/" + conversation
    sent = client.post(base + "/messages", headers=alice, data={"content": "Hola"})
    assert sent.status_code == 201 and sent.json()["status"] == "sent"
    assert client.post(base + "/read", headers=outsider).status_code == 403
    assert client.get(base + "/messages", headers=outsider).status_code == 403
    assert client.post("/api/v1/chat/delivered", headers=bob).status_code == 204
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "delivered"
    assert client.post(base + "/read", headers=bob).status_code == 204
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "read"
    client.post(base + "/delivered", headers=bob)
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "read"
    for filename, body, mime in [
        ("photo.png", b"png-test", "image/png"),
        ("notes.pdf", b"%PDF-test", "application/pdf"),
        ("notes.docx", b"word-test", "application/octet-stream"),
    ]:
        response = client.post(
            base + "/messages",
            headers=alice,
            files={"file": (filename, body, "application/octet-stream")},
        )
        assert response.status_code == 201, response.text
        attachment = response.json()
        assert attachment["attachment"]["content_type"] == mime
        assert attachment["attachment"]["size_bytes"] == len(body)
        url = "/api/v1/chat/messages/" + attachment["id"] + "/attachment"
        assert client.get(url, headers=bob).content == body
        assert client.get(url, headers=outsider).status_code == 403
    assert (
        client.post(
            base + "/messages", headers=alice, files={"file": ("bad.exe", b"bad")}
        ).status_code
        == 400
    )
    assert (
        client.post(
            base + "/messages", headers=alice, files={"file": ("empty.pdf", b"")}
        ).status_code
        == 400
    )
    assert (
        client.post(
            base + "/messages",
            headers=alice,
            files={"file": ("large.pdf", b"a" * (25 * 1024 * 1024 + 1))},
        ).status_code
        == 413
    )


def test_group_ticks_wait_for_every_recipient(client):
    alice, _, _ = account(client, "alice")
    bob, b, _ = account(client, "bob")
    cara, c, _ = account(client, "cara")
    conversation = client.post(
        "/api/v1/chat/conversations",
        headers=alice,
        json={"kind": "group", "title": "Estudio", "usernames": [b["username"], c["username"]]},
    ).json()["id"]
    base = "/api/v1/chat/conversations/" + conversation
    client.post(base + "/messages", headers=alice, data={"content": "Todos"})
    client.post(base + "/read", headers=bob)
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "sent"
    client.post(base + "/delivered", headers=cara)
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "delivered"
    client.post(base + "/read", headers=cara)
    assert client.get(base + "/messages", headers=alice).json()[0]["status"] == "read"


def test_presence_is_real_and_last_seen_persists(client):
    alice, _, _ = account(client, "alice")
    _, b, token = account(client, "bob")
    conversation = direct(client, alice, b["username"])
    url = "/api/v1/chat/conversations/" + conversation + "/presence"
    assert client.get(url, headers=alice).json()[0]["online"] is False
    with client.websocket_connect("/api/v1/ws?token=" + token):
        with client.websocket_connect("/api/v1/ws?token=" + token):
            assert client.get(url, headers=alice).json()[0]["online"] is True
        assert client.get(url, headers=alice).json()[0]["online"] is True
    offline = client.get(url, headers=alice).json()[0]
    assert offline["online"] is False
    assert datetime.fromisoformat(offline["last_seen_at"])


def test_websocket_delivers_message_and_receipt_events(client):
    alice, _, a_token = account(client, "alice")
    bob, b, b_token = account(client, "bob")
    conversation = direct(client, alice, b["username"])
    with client.websocket_connect("/api/v1/ws?token=" + a_token) as a_socket:
        with client.websocket_connect("/api/v1/ws?token=" + b_token) as b_socket:
            presence = a_socket.receive_json()
            assert presence["data"]["action"] == "presence"
            assert presence["data"]["online"] is True
            response = client.post(
                "/api/v1/chat/conversations/" + conversation + "/messages",
                headers=alice,
                data={"content": "Realtime"},
            )
            received = b_socket.receive_json()
            while received.get("data", {}).get("action") != "message":
                received = b_socket.receive_json()
            assert received["data"]["message"]["id"] == response.json()["id"]
            assert received["data"]["message"]["status"] == "sent"
            # The sender also receives its own message event before the receipt.
            assert a_socket.receive_json()["data"]["action"] == "message"
            client.post("/api/v1/chat/delivered", headers=bob)
            assert a_socket.receive_json()["data"]["status"] == "delivered"
            client.post("/api/v1/chat/conversations/" + conversation + "/read", headers=bob)
            assert a_socket.receive_json()["data"]["status"] == "read"
        assert a_socket.receive_json()["data"]["online"] is False


def test_read_cursor_does_not_acknowledge_unseen_messages(client):
    alice, _, _ = account(client, "alice")
    bob, b, _ = account(client, "bob")
    conversation = direct(client, alice, b["username"])
    base = "/api/v1/chat/conversations/" + conversation
    first = client.post(base + "/messages", headers=alice, data={"content": "Visto"}).json()
    second = client.post(base + "/messages", headers=alice, data={"content": "Aun no visto"}).json()
    assert client.post(base + "/read?through=" + first["id"], headers=bob).status_code == 204
    messages = client.get(base + "/messages", headers=alice).json()
    assert [message["status"] for message in messages] == ["read", "sent"]
    assert client.get("/api/v1/chat/conversations", headers=bob).json()[0]["unread_count"] == 1
    assert client.post(base + "/read?through=" + second["id"], headers=bob).status_code == 204
    client.post(base + "/read?through=" + first["id"], headers=bob)
    assert client.get("/api/v1/chat/conversations", headers=bob).json()[0]["unread_count"] == 0
