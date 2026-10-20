"""Endpoints de cuadernos de notas y su exportacion a Word."""
from __future__ import annotations

import io
import uuid
from typing import Literal
from urllib.parse import quote

from docx import Document as DocxDocument
from docx.shared import Pt, RGBColor
from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.notebook import Notebook
from app.models.shared_class import ClassMembership
from app.schemas.notebook import NotebookCreate, NotebookRead, NotebookUpdate

router = APIRouter(prefix="/notebooks", tags=["notebooks"])


class NotebookShareUpdate(BaseModel):
    class_id: uuid.UUID
    permission: Literal["read", "edit"] = "read"

_INK = RGBColor(0x31, 0x2E, 0x81)
_GREY = RGBColor(0x64, 0x74, 0x8B)


def _docx_response(doc: DocxDocument, filename: str) -> Response:
    buffer = io.BytesIO()
    doc.save(buffer)
    ascii_name = "cuaderno.docx"
    encoded = quote(f"{filename}.docx")
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"
        },
    )


@router.get("", response_model=list[NotebookRead])
async def list_notebooks(current_user: CurrentUser, db: DbSession) -> list[Notebook]:
    result = await db.execute(
        select(Notebook)
        .where(Notebook.user_id == current_user.id)
        .order_by(Notebook.updated_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate, current_user: CurrentUser, db: DbSession
) -> Notebook:
    notebook = Notebook(
        user_id=current_user.id,
        title=payload.title,
        color=payload.color,
        content=payload.content,
    )
    db.add(notebook)
    await db.commit()
    await db.refresh(notebook)
    return notebook


@router.get("/{notebook_id}", response_model=NotebookRead)
async def get_notebook(
    notebook_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Notebook:
    return await _get_accessible(notebook_id, current_user.id, db)


@router.patch("/{notebook_id}", response_model=NotebookRead)
async def update_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Notebook:
    notebook = await _get_accessible(notebook_id, current_user.id, db, write=True)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(notebook, key, value)
    await db.commit()
    await db.refresh(notebook)
    return notebook


@router.put("/{notebook_id}/share", response_model=NotebookRead)
async def share_notebook(
    notebook_id: uuid.UUID,
    payload: NotebookShareUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> Notebook:
    notebook = await _get_owned(notebook_id, current_user.id, db)
    membership = await db.execute(
        select(ClassMembership).where(
            ClassMembership.class_id == payload.class_id,
            ClassMembership.user_id == current_user.id,
        )
    )
    if membership.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes compartir con una clase a la que perteneces",
        )
    notebook.shared_class_id = payload.class_id
    notebook.share_permission = payload.permission
    await db.commit()
    await db.refresh(notebook)
    return notebook


@router.delete("/{notebook_id}/share", response_model=NotebookRead)
async def unshare_notebook(
    notebook_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Notebook:
    notebook = await _get_owned(notebook_id, current_user.id, db)
    notebook.shared_class_id = None
    notebook.share_permission = "read"
    await db.commit()
    await db.refresh(notebook)
    return notebook


@router.delete("/{notebook_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_notebook(
    notebook_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    notebook = await _get_owned(notebook_id, current_user.id, db)
    await db.delete(notebook)
    await db.commit()


@router.get("/{notebook_id}/word")
async def export_notebook_word(
    notebook_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Response:
    notebook = await _get_owned(notebook_id, current_user.id, db)
    document = DocxDocument()

    title = document.add_heading(notebook.title or "Cuaderno", level=0)
    for run in title.runs:
        run.font.color.rgb = _INK

    meta = document.add_paragraph()
    run = meta.add_run(
        f"Academic Autopilot · Actualizado: {notebook.updated_at.strftime('%d/%m/%Y %H:%M')}"
    )
    run.font.size = Pt(9)
    run.font.color.rgb = _GREY

    for block in (notebook.content or "").split("\n"):
        line = block.rstrip()
        if not line:
            document.add_paragraph()
            continue
        if line.startswith("### "):
            document.add_heading(line[4:], level=3)
        elif line.startswith("## "):
            document.add_heading(line[3:], level=2)
        elif line.startswith("# "):
            document.add_heading(line[2:], level=1)
        elif line.startswith(("- ", "* ")):
            document.add_paragraph(line[2:], style="List Bullet")
        else:
            document.add_paragraph(line)

    return _docx_response(document, notebook.title or "cuaderno")


async def _get_owned(notebook_id: uuid.UUID, user_id: uuid.UUID, db: DbSession) -> Notebook:
    notebook = await db.get(Notebook, notebook_id)
    if notebook is None or notebook.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cuaderno no encontrado"
        )
    return notebook


async def _get_accessible(
    notebook_id: uuid.UUID,
    user_id: uuid.UUID,
    db: DbSession,
    *,
    write: bool = False,
) -> Notebook:
    """Cuaderno propio o compartido con una clase a la que pertenece el usuario."""
    notebook = await db.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cuaderno no encontrado"
        )
    if notebook.user_id == user_id:
        return notebook
    if notebook.shared_class_id is not None:
        result = await db.execute(
            select(ClassMembership).where(
                ClassMembership.class_id == notebook.shared_class_id,
                ClassMembership.user_id == user_id,
            )
        )
        if result.scalar_one_or_none() is not None:
            if not write or notebook.share_permission == "edit":
                return notebook
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Cuaderno no encontrado"
    )
