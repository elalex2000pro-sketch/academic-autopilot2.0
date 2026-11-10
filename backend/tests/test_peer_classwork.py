from pathlib import Path
"""Real peer flow and privacy boundaries, including owner and outsider."""

import pytest
from fastapi.testclient import TestClient
from chat_test_server import create_test_app
from test_chat_flow import account
from app.core.rate_limit import limiter


@pytest.fixture
def client(tmp_path):
    limiter.reset()
    with TestClient(create_test_app(tmp_path)) as c:
        yield c


def setup(c):
    a, _, _ = account(c, "owner")
    b, _, _ = account(c, "peer")
    outsider, _, _ = account(c, "outsider")
    r = c.post("/api/v1/classes", headers=a, json={"name": "Compañeros"})
    assert r.status_code == 201, r.text
    group = r.json()
    assert (
        c.post("/api/v1/classes/join", headers=b, json={"code": group["code"]}).status_code == 200
    )
    return a, b, outsider, "/api/v1/classes/" + group["id"]


def test_two_students_workflow_and_privacy(client):
    c = client
    a, b, x, base = setup(c)
    t = c.post(base + "/topics", headers=b, json={"title": "Redes", "order": 2})
    assert t.status_code == 201, t.text
    tid = t.json()["id"]
    r = c.post(base + "/assignments", headers=b, json={"title": "Repasar TCP", "topic_id": tid})
    assert r.status_code == 201, r.text
    task = r.json()
    path = base + "/assignments/" + task["id"]
    assert c.get(base + "/assignments", headers=x).status_code == 403
    assert c.post(base + "/topics", headers=x, json={"title": "No"}).status_code == 403
    for state in ["pending", "in_progress", "done"]:
        r = c.put(
            path + "/work", headers=b, json={"state": state, "note": "Mi nota: 8", "shared": False}
        )
        assert r.status_code == 200, r.text
    uploaded = c.post(
        path + "/work/files",
        headers=b,
        files={"file": ("mi-trabajo.pdf", b"%PDF-test", "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    url = path + "/work/files/" + uploaded.json()["id"]
    assert c.get(url, headers=b).content == b"%PDF-test"
    assert c.get(url, headers=a).status_code == 404
    assert c.get(url, headers=x).status_code == 403
    viewed = c.get(base + "/assignments", headers=a).json()[0]
    assert viewed["works"] == [] and viewed["completed_count"] == 1 and viewed["total_members"] == 2
    assert len(viewed["finished"]) == 1
    assert "Mi nota" not in str(viewed)
    assert (
        c.put(
            path + "/work", headers=b, json={"state": "done", "shared": True, "note": "Mi nota: 8"}
        ).status_code
        == 200
    )
    viewed = c.get(base + "/assignments", headers=a).json()[0]
    assert viewed["works"][0]["note"] == "Mi nota: 8"
    assert c.get(url, headers=a).content == b"%PDF-test"
    assert (
        c.post(path + "/comments", headers=a, json={"content": "¿Repasamos juntos?"}).status_code
        == 201
    )
    assert c.get(path + "/comments", headers=b).json()[0]["content"] == "¿Repasamos juntos?"
    assert c.get(path + "/comments", headers=x).status_code == 403
    assert (
        c.put(path + "/work", headers=a, json={"state": "done", "user_id": "fake"}).status_code
        == 422
    )
    c.put(
        path + "/work",
        headers=b,
        json={"state": "in_progress", "shared": False, "note": "Otra privada"},
    )
    assert c.get(url, headers=a).status_code == 404
    assert c.get(base + "/assignments", headers=a).json()[0]["completed_count"] == 0


def test_permissions_and_cross_class_links(client):
    c = client
    a, b, x, base = setup(c)
    tid = c.post(base + "/topics", headers=a, json={"title": "Tema"}).json()["id"]
    task = c.post(base + "/assignments", headers=a, json={"title": "Del dueño"}).json()
    path = base + "/assignments/" + task["id"]
    assert c.patch(path, headers=b, json={"title": "Ajena"}).status_code == 403
    assert c.delete(path, headers=b).status_code == 403
    assert c.patch(base + "/topics/" + tid, headers=b, json={"title": "Ajeno"}).status_code == 403
    assert c.delete(base + "/topics/" + tid, headers=b).status_code == 403
    peer = c.post(base + "/assignments", headers=b, json={"title": "Del compañero"}).json()
    assert (
        c.patch(
            base + "/assignments/" + peer["id"], headers=a, json={"title": "Editada"}
        ).status_code
        == 200
    )
    other = c.post("/api/v1/classes", headers=x, json={"name": "Otra"}).json()
    foreign = c.post(
        "/api/v1/classes/" + other["id"] + "/topics", headers=x, json={"title": "Privado"}
    ).json()["id"]
    assert (
        c.post(
            base + "/assignments", headers=b, json={"title": "Mal", "topic_id": foreign}
        ).status_code
        == 404
    )
    assert c.post(base + "/assignments", headers=b, json={"title": " "}).status_code == 422
    assert c.delete(base + "/topics/" + tid, headers=a).status_code == 204


def test_migration_preserves_existing_completions():
    import importlib.util
    from io import StringIO
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    source=Path(__file__).parents[1] / "alembic/versions/0022_peer_classwork.py"
    spec=importlib.util.spec_from_file_location("migration22",source)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    output=StringIO()
    context=MigrationContext.configure(dialect_name="postgresql",opts={"as_sql":True,"output_buffer":output})
    with Operations.context(context): module.upgrade()
    sql=output.getvalue()
    assert "DEFAULT 'done' NOT NULL" in sql
    assert "SET DEFAULT 'pending'" in sql
    assert "DELETE FROM" not in sql and "DROP TABLE" not in sql
