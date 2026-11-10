"""Trabajo entre alumnos: membresía y privacidad se verifican en cada petición."""

import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.classwork import (
    ClassAssignment,
    ClassAssignmentAttachment,
    ClassAssignmentCompletion,
    ClassTopic,
    ClassWorkComment,
    ClassWorkFile,
)
from app.models.document import Document
from app.models.shared_class import ClassMembership
from app.models.user import User
from app.services import class_service

router = APIRouter(prefix="/classes/{class_id}", tags=["classwork"])


class TopicInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    order: int = 0


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)

    description: str | None = Field(default=None, max_length=4000)

    due_at: datetime | None = None

    topic_id: uuid.UUID | None = None

    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)


class WorkInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: Literal["pending", "in_progress", "done"]

    note: str | None = Field(default=None, max_length=4000)

    shared: bool = False


class CommentInput(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


async def member(db, cid, uid):
    row = (
        await db.execute(
            select(ClassMembership).where(
                ClassMembership.class_id == cid, ClassMembership.user_id == uid
            )
        )
    ).scalar_one_or_none()

    if row is None:
        raise HTTPException(403, "No eres miembro de esta clase")

    return row


async def item(db, model, cid, ident):
    obj = await db.get(model, ident)

    if obj is None or obj.class_id != cid:
        raise HTTPException(404, "Elemento no encontrado")

    return obj


async def editor(db, cid, uid, obj):
    membership = await member(db, cid, uid)

    if obj.created_by != uid and membership.role != "owner":
        raise HTTPException(403, "Solo quien lo creó o el dueño puede modificarlo")


async def changed(db, cid):
    await class_service.notify_class(db, cid, "classwork_updated")


def person(user):
    return {"id": str(user.id), "username": user.username, "name": user.full_name or user.username}


async def work_read(db, work):
    files = (
        (await db.execute(select(ClassWorkFile).where(ClassWorkFile.work_id == work.id)))
        .scalars()
        .all()
    )

    return {
        "user": person(await db.get(User, work.user_id)),
        "state": work.state,
        "note": work.note,
        "shared": work.shared,
        "files": [{"id": str(f.id), "name": f.name, "size": f.size} for f in files],
    }


async def task_read(db, task, uid):
    members = (
        (
            await db.execute(
                select(ClassMembership.user_id).where(ClassMembership.class_id == task.class_id)
            )
        )
        .scalars()
        .all()
    )

    works = (
        (
            await db.execute(
                select(ClassAssignmentCompletion).where(
                    ClassAssignmentCompletion.assignment_id == task.id,
                    ClassAssignmentCompletion.user_id.in_(members),
                )
            )
        )
        .scalars()
        .all()
    )

    done = [person(await db.get(User, w.user_id)) for w in works if w.state == "done"]

    attachments = (
        (
            await db.execute(
                select(Document)
                .join(
                    ClassAssignmentAttachment, ClassAssignmentAttachment.document_id == Document.id
                )
                .where(
                    ClassAssignmentAttachment.assignment_id == task.id,
                    Document.class_id == task.class_id,
                )
            )
        )
        .scalars()
        .all()
    )

    mine = next((w for w in works if w.user_id == uid), None)

    return {
        "id": str(task.id),
        "class_id": str(task.class_id),
        "created_by": str(task.created_by),
        "title": task.title,
        "description": task.description,
        "due_at": task.due_at,
        "created_at": task.created_at,
        "topic_id": str(task.topic_id) if task.topic_id else None,
        "my_state": mine.state if mine else "pending",
        "my_completed": bool(mine and mine.state == "done"),
        "completed_count": len(done),
        "total_members": len(members),
        "finished": done,
        "attachments": [{"id": str(d.id), "name": d.filename} for d in attachments],
        "works": [await work_read(db, w) for w in works if w.user_id == uid or w.shared],
    }


@router.get("/topics")
async def topics(class_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    await member(db, class_id, current_user.id)

    rows = (
        (
            await db.execute(
                select(ClassTopic)
                .where(ClassTopic.class_id == class_id)
                .order_by(ClassTopic.order, ClassTopic.created_at)
            )
        )
        .scalars()
        .all()
    )

    return [
        {"id": str(t.id), "title": t.title, "order": t.order, "created_by": str(t.created_by)}
        for t in rows
    ]


@router.post("/topics", status_code=201)
async def create_topic(
    class_id: uuid.UUID, payload: TopicInput, current_user: CurrentUser, db: DbSession
):
    await member(db, class_id, current_user.id)

    if not payload.title.strip():
        raise HTTPException(422, "Escribe un título")

    topic = ClassTopic(
        class_id=class_id,
        created_by=current_user.id,
        title=payload.title.strip(),
        order=payload.order,
    )

    db.add(topic)
    await db.commit()
    await changed(db, class_id)

    return {"id": str(topic.id)}


@router.patch("/topics/{topic_id}")
async def edit_topic(
    class_id: uuid.UUID,
    topic_id: uuid.UUID,
    payload: TopicInput,
    current_user: CurrentUser,
    db: DbSession,
):
    topic = await item(db, ClassTopic, class_id, topic_id)
    await editor(db, class_id, current_user.id, topic)

    if not payload.title.strip():
        raise HTTPException(422, "Escribe un título")

    topic.title = payload.title.strip()
    topic.order = payload.order

    await db.commit()
    await changed(db, class_id)

    return {"id": str(topic.id)}


@router.delete("/topics/{topic_id}", status_code=204)
async def delete_topic(
    class_id: uuid.UUID, topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession
):
    topic = await item(db, ClassTopic, class_id, topic_id)
    await editor(db, class_id, current_user.id, topic)

    await db.delete(topic)
    await db.commit()
    await changed(db, class_id)


@router.get("/assignments")
async def assignments(class_id: uuid.UUID, current_user: CurrentUser, db: DbSession):
    await member(db, class_id, current_user.id)

    rows = (
        (
            await db.execute(
                select(ClassAssignment)
                .where(ClassAssignment.class_id == class_id)
                .order_by(ClassAssignment.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    return [await task_read(db, task, current_user.id) for task in rows]


async def fill_task(db, cid, task, payload):
    if not payload.title.strip():
        raise HTTPException(422, "Escribe un título")

    if payload.topic_id:
        await item(db, ClassTopic, cid, payload.topic_id)

    documents = []

    for ident in set(payload.attachment_ids):
        documents.append(await item(db, Document, cid, ident))

    task.title = payload.title.strip()
    task.description = payload.description
    task.due_at = payload.due_at
    task.topic_id = payload.topic_id

    await db.flush()

    previous = (
        (
            await db.execute(
                select(ClassAssignmentAttachment).where(
                    ClassAssignmentAttachment.assignment_id == task.id
                )
            )
        )
        .scalars()
        .all()
    )

    for link in previous:
        await db.delete(link)

    for document in documents:
        db.add(ClassAssignmentAttachment(assignment_id=task.id, document_id=document.id))


@router.post("/assignments", status_code=201)
async def create_assignment(
    class_id: uuid.UUID, payload: TaskInput, current_user: CurrentUser, db: DbSession
):
    await member(db, class_id, current_user.id)

    task = ClassAssignment(class_id=class_id, created_by=current_user.id, title=payload.title)

    db.add(task)
    await fill_task(db, class_id, task, payload)
    await db.commit()
    await changed(db, class_id)

    return await task_read(db, task, current_user.id)


@router.patch("/assignments/{assignment_id}")
async def edit_assignment(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: TaskInput,
    current_user: CurrentUser,
    db: DbSession,
):
    task = await item(db, ClassAssignment, class_id, assignment_id)
    await editor(db, class_id, current_user.id, task)

    await fill_task(db, class_id, task, payload)
    await db.commit()
    await changed(db, class_id)

    return await task_read(db, task, current_user.id)


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(
    class_id: uuid.UUID, assignment_id: uuid.UUID, current_user: CurrentUser, db: DbSession
):
    task = await item(db, ClassAssignment, class_id, assignment_id)
    await editor(db, class_id, current_user.id, task)

    await db.delete(task)
    await db.commit()
    await changed(db, class_id)


async def my_work(db, aid, uid):
    await db.execute(select(ClassAssignment).where(ClassAssignment.id == aid).with_for_update())

    work = (
        await db.execute(
            select(ClassAssignmentCompletion).where(
                ClassAssignmentCompletion.assignment_id == aid,
                ClassAssignmentCompletion.user_id == uid,
            )
        )
    ).scalar_one_or_none()

    if work is None:
        work = ClassAssignmentCompletion(assignment_id=aid, user_id=uid)
        db.add(work)
        await db.flush()

    return work


@router.put("/assignments/{assignment_id}/work")
async def save_work(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: WorkInput,
    current_user: CurrentUser,
    db: DbSession,
):
    await member(db, class_id, current_user.id)
    await item(db, ClassAssignment, class_id, assignment_id)

    work = await my_work(db, assignment_id, current_user.id)

    work.state = payload.state
    work.note = payload.note
    work.shared = payload.shared

    await db.commit()
    await changed(db, class_id)

    return await work_read(db, work)


@router.post("/assignments/{assignment_id}/work/files", status_code=201)
async def upload_work(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
):
    await member(db, class_id, current_user.id)
    await item(db, ClassAssignment, class_id, assignment_id)

    from app.api.v1.chat import _ALLOWED_ATTACHMENTS

    name = Path(file.filename or "archivo").name[:300]

    if name.rsplit(".", 1)[-1].lower() not in _ALLOWED_ATTACHMENTS:
        raise HTTPException(400, "Formato no permitido")

    data = await file.read(25 * 1024 * 1024 + 1)

    if not data or len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Archivo vacío o mayor de 25 MB")

    work = await my_work(db, assignment_id, current_user.id)

    relative = "classwork/" + uuid.uuid4().hex

    target = Path(settings.files_dir) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)

    record = ClassWorkFile(work_id=work.id, name=name, size=len(data), storage_path=relative)
    db.add(record)

    await db.commit()
    await changed(db, class_id)

    return {"id": str(record.id)}


@router.get("/assignments/{assignment_id}/work/files/{file_id}")
async def download_work(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
):
    await member(db, class_id, current_user.id)
    await item(db, ClassAssignment, class_id, assignment_id)

    record = await db.get(ClassWorkFile, file_id)

    work = await db.get(ClassAssignmentCompletion, record.work_id) if record else None

    if (
        work is None
        or work.assignment_id != assignment_id
        or (work.user_id != current_user.id and not work.shared)
    ):
        raise HTTPException(404, "Archivo no encontrado")

    return FileResponse(
        Path(settings.files_dir) / record.storage_path,
        filename=record.name,
        media_type="application/octet-stream",
    )


@router.get("/assignments/{assignment_id}/comments")
async def comments(
    class_id: uuid.UUID, assignment_id: uuid.UUID, current_user: CurrentUser, db: DbSession
):
    await member(db, class_id, current_user.id)
    await item(db, ClassAssignment, class_id, assignment_id)

    rows = (
        (
            await db.execute(
                select(ClassWorkComment)
                .where(ClassWorkComment.assignment_id == assignment_id)
                .order_by(ClassWorkComment.created_at)
            )
        )
        .scalars()
        .all()
    )

    return [
        {
            "id": str(c.id),
            "author": person(await db.get(User, c.user_id)),
            "content": c.content,
            "created_at": c.created_at,
        }
        for c in rows
    ]


@router.post("/assignments/{assignment_id}/comments", status_code=201)
async def comment(
    class_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: CommentInput,
    current_user: CurrentUser,
    db: DbSession,
):
    await member(db, class_id, current_user.id)
    await item(db, ClassAssignment, class_id, assignment_id)

    if not payload.content.strip():
        raise HTTPException(422, "Escribe un comentario")

    db.add(
        ClassWorkComment(
            assignment_id=assignment_id, user_id=current_user.id, content=payload.content.strip()
        )
    )

    await db.commit()
    await changed(db, class_id)

    return {"ok": True}
