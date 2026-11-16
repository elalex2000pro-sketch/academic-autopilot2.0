"""Declaraciones locales, confirmacion del conector y migracion sin perdida."""
from __future__ import annotations

import asyncio
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.api.deps import get_db
from app.connectors.base import NormalizedTask
from app.models.enums import DeliveryStatus, Provider, SourcePlatform, TaskStatus
from app.models.task import Task
from app.models.user import User
from app.services import sync_service
from test_chat_flow import account
from test_peer_classwork import client


def create(c, owner, **fields):
    r = c.post("/api/v1/tasks", headers=owner, json={"title": "Entrega externa", **fields})
    assert r.status_code == 201, r.text
    return "/api/v1/tasks/" + r.json()["id"], r.json()


@pytest.mark.parametrize("previous", ["pending", "in_progress", "completed"])
def test_declare_and_undo_restore_previous_status_without_changing_due_date(client, previous):
    owner, _, _ = account(client, "declarer")
    path, original = create(client, owner, due_at="2030-05-20T12:00:00Z")
    client.patch(path, headers=owner, json={"status": previous})
    declared = client.post(path + "/delivery", headers=owner, json={
        "note": "Entregada en papel", "url": "https://drive.google.com/file/d/ejemplo/view",
    })
    assert declared.status_code == 200, declared.text
    data = declared.json()
    assert data["delivery_status"] == "declared" and data["status"] == "completed"
    assert data["delivered_at"] and data["delivery_note"] == "Entregada en papel"
    assert data["delivery_url"] == "https://drive.google.com/file/d/ejemplo/view"
    assert data["due_at"] == original["due_at"]
    # Recargar y repetir la peticion no debe perder la fecha ni el estado previo.
    assert client.get(path, headers=owner).json() == data
    repeated = client.post(path + "/delivery", headers=owner, json={}).json()
    assert repeated["delivered_at"] == data["delivered_at"]
    assert repeated["delivery_note"] == data["delivery_note"]
    assert client.patch(path, headers=owner, json={"status": "pending"}).status_code == 409
    undone = client.delete(path + "/delivery", headers=owner)
    assert undone.status_code == 200, undone.text
    assert undone.json()["status"] == previous
    assert undone.json()["delivery_status"] == "none"
    assert all(undone.json()[key] is None for key in ("delivered_at", "delivery_note", "delivery_url"))
    assert undone.json()["due_at"] == original["due_at"]
    assert client.delete(path + "/delivery", headers=owner).json()["status"] == previous


def test_delivery_permissions_and_validation(client):
    owner, _, _ = account(client, "deliveryowner")
    other, _, _ = account(client, "deliveryother")
    path, _ = create(client, owner)
    assert client.post(path + "/delivery", headers=other, json={}).status_code == 404
    assert client.delete(path + "/delivery", headers=other).status_code == 404
    for body in ({"url": "javascript:alert(1)"}, {"url": "file:///secret"}, {"note": "x" * 2001}, {"delivery_status": "confirmed"}):
        assert client.post(path + "/delivery", headers=owner, json=body).status_code == 422
    assert client.patch(path, headers=owner, json={"delivery_status": "confirmed"}).json()["delivery_status"] == "none"
    assert client.post(path + "/delivery", json={}).status_code in (401, 403)
    client.delete(path, headers=owner)
    assert client.post(path + "/delivery", headers=owner, json={}).status_code == 409


def test_undo_does_not_unarchive_task(client):
    owner, _, _ = account(client, "archiveddelivery")
    path, _ = create(client, owner)
    client.post(path + "/delivery", headers=owner, json={})
    client.delete(path, headers=owner)
    undone = client.delete(path + "/delivery", headers=owner)
    assert undone.status_code == 200
    assert undone.json()["status"] == "archived" and undone.json()["delivery_status"] == "none"


def test_sync_preserves_declaration_and_only_promotes_on_positive_verification(client):
    owner, profile, _ = account(client, "deliverysync")
    path, task = create(client, owner)
    client.post(path + "/delivery", headers=owner, json={"note": "En papel"})

    async def sync(completed, known):
        async for db in client.app.dependency_overrides[get_db]():
            current = await db.get(Task, UUID(task["id"]))
            current.source = SourcePlatform.moodle
            current.external_id = "moodle-1"
            await db.commit()
            user = await db.get(User, UUID(profile["id"]))
            await sync_service._upsert_tasks(db, user, Provider.moodle, [NormalizedTask(
                external_id="moodle-1", title=task["title"], completed=completed, completion_known=known,
            )])
            await db.commit()

    original = client.get(path, headers=owner).json()
    for completed, known in [(False, True), (True, False), (False, False)]:
        asyncio.run(sync(completed, known))
        current = client.get(path, headers=owner).json()
        assert current["delivery_status"] == "declared" and current["status"] == "completed"
        assert current["delivered_at"] == original["delivered_at"]
        assert current["delivery_note"] == "En papel"
    asyncio.run(sync(True, True))
    confirmed = client.get(path, headers=owner).json()
    assert confirmed["delivery_status"] == "confirmed"
    assert confirmed["delivered_at"] == original["delivered_at"]
    assert confirmed["delivery_note"] == "En papel"
    assert client.delete(path + "/delivery", headers=owner).status_code == 409
    assert client.post(path + "/delivery", headers=owner, json={}).status_code == 409
    asyncio.run(sync(False, False))
    assert client.get(path, headers=owner).json()["delivery_status"] == "confirmed"


def test_sync_marks_new_and_existing_deliveries_confirmed(client):
    owner, profile, _ = account(client, "newconfirmed")

    async def sync():
        async for db in client.app.dependency_overrides[get_db]():
            user = await db.get(User, UUID(profile["id"]))
            item = NormalizedTask(external_id="classroom-1", title="Ya entregada", completed=True, completion_known=True)
            assert await sync_service._upsert_tasks(db, user, Provider.google_classroom, [item]) == (1, 0)
            await db.commit()
            assert await sync_service._upsert_tasks(db, user, Provider.google_classroom, [item]) == (0, 0)
            await db.commit()
    asyncio.run(sync())
    task = client.get("/api/v1/tasks", headers=owner).json()[0]
    assert task["status"] == "completed" and task["delivery_status"] == "confirmed"
    assert task["delivered_at"]


def test_declaration_restores_only_previously_pending_parts(client):
    owner, profile, _ = account(client, "parts")
    path, parent = create(client, owner)
    async def parts():
        async for db in client.app.dependency_overrides[get_db]():
            for index, state in enumerate((TaskStatus.pending, TaskStatus.in_progress, TaskStatus.completed)):
                db.add(Task(user_id=UUID(profile["id"]), parent_task_id=UUID(parent["id"]),
                            source=SourcePlatform.manual, external_id=f"part-{index}", title=f"Parte {index}", status=state))
            await db.commit()
    asyncio.run(parts())
    client.post(path + "/delivery", headers=owner, json={})
    assert all(t["status"] == "completed" for t in client.get("/api/v1/tasks", headers=owner).json())
    client.delete(path + "/delivery", headers=owner)
    states = {t["title"]: t["status"] for t in client.get("/api/v1/tasks", headers=owner).json()}
    assert states["Parte 0"] == "pending" and states["Parte 1"] == "in_progress" and states["Parte 2"] == "completed"


def test_additive_migration_keeps_existing_tasks(tmp_path, monkeypatch):
    path = Path(__file__).parents[1] / "alembic/versions/0026_task_delivery.py"
    spec = importlib.util.spec_from_file_location("delivery_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    metadata = sa.MetaData()
    old = sa.Table("tasks", metadata,
        sa.Column("id", sa.String, primary_key=True), sa.Column("title", sa.String),
        sa.Column("status", sa.String), sa.Column("due_at", sa.DateTime), sa.Column("description", sa.Text))
    engine = sa.create_engine("sqlite:///" + str(tmp_path / "migration.sqlite"))
    before = [dict(id=str(i), title="Tarea previa " + status, status=status,
                   due_at=datetime(2030, 5, 20), description="Texto que debe conservarse")
              for i, status in enumerate(("pending", "in_progress", "completed", "archived"))]
    with engine.begin() as connection:
        metadata.create_all(connection)
        connection.execute(old.insert(), before)
        monkeypatch.setattr(migration, "op", Operations(MigrationContext.configure(connection)))
        migration.upgrade()
        migrated = sa.Table("tasks", sa.MetaData(), autoload_with=connection)
        rows = connection.execute(sa.select(migrated).order_by(migrated.c.id)).mappings().all()
        for expected, row in zip(before, rows, strict=True):
            assert {key: row[key] for key in expected} == expected
            assert row["delivery_status"] == "none"
            assert all(row[key] is None for key in ("delivered_at", "delivery_note", "delivery_url", "delivery_previous_status"))
        migration.downgrade()
        assert connection.execute(sa.select(old).order_by(old.c.id)).mappings().all() == before
    engine.dispose()
