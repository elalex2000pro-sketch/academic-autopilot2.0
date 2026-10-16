"""Generacion de PDF para IA Studio (resumen e infografia) con ReportLab."""
from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_ACCENT = colors.HexColor("#4f46e5")
_ACCENT_DARK = colors.HexColor("#312e81")
_LIGHT = colors.HexColor("#eef2ff")
_GREY = colors.HexColor("#334155")


def _safe(text: str) -> str:
    """Asegura que el texto sea representable con las fuentes estandar (WinAnsi)."""
    if not text:
        return ""
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _wrap(text: str, font: str, size: float, max_width: float) -> list[str]:
    return simpleSplit(_safe(text), font, size, max_width)


def build_summary_pdf(
    title: str,
    meta: dict[str, Any],
    summary: str,
    key_points: list[str],
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleX", parent=styles["Heading1"], fontSize=20, textColor=_ACCENT, spaceAfter=6
    )
    meta_style = ParagraphStyle("MetaX", parent=styles["Normal"], fontSize=9, textColor=_GREY)
    body_style = ParagraphStyle("BodyX", parent=styles["Normal"], fontSize=11, leading=16)
    head_style = ParagraphStyle("HeadX", parent=styles["Heading2"], fontSize=13, textColor=_ACCENT, spaceBefore=8)

    story: list[Any] = [
        Paragraph(_safe(title), title_style),
        Paragraph(
            f"Origen: {_safe(meta.get('filename',''))} · Generado: {_safe(meta.get('created_at',''))}",
            meta_style,
        ),
        Spacer(1, 6),
    ]

    story.append(Paragraph("Resumen", head_style))
    for para in [p.strip() for p in (summary or "").split("\n") if p.strip()]:
        story.append(Paragraph(_safe(para), body_style))
        story.append(Spacer(1, 4))

    if key_points:
        story.append(Paragraph("Puntos clave", head_style))
        rows = [[Paragraph("<b>%d.</b> %s" % (i + 1, _safe(p)), body_style)] for i, p in enumerate(key_points)]
        table = Table(rows, colWidths=[doc.width])
        table.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND", (0, 0), (-1, -1), _LIGHT),
        ]))
        story.append(table)

    doc.build(story)
    return buffer.getvalue()


def build_infographic_pdf(
    title: str,
    subtitle: str,
    sections: list[dict[str, Any]],
    stats: list[dict[str, Any]],
) -> bytes:
    buffer = io.BytesIO()
    page_w, page_h = A4
    c = pdf_canvas.Canvas(buffer, pagesize=A4)

    # --- Cabecera ---
    band_h = 46 * mm
    c.setFillColor(_ACCENT_DARK)
    c.rect(0, page_h - band_h, page_w, band_h, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    y_title = page_h - 22 * mm
    for line in _wrap(title, "Helvetica-Bold", 22, page_w - 30 * mm)[:2]:
        c.drawString(15 * mm, y_title, line)
        y_title -= 10 * mm
    c.setFont("Helvetica", 11)
    c.drawString(15 * mm, y_title - 1 * mm, _safe(subtitle or ""))

    y = page_h - band_h - 12 * mm

    # --- Estadisticas ---
    if stats:
        n = len(stats)
        box_w = (page_w - 30 * mm - (n - 1) * 5 * mm) / n
        for i, s in enumerate(stats[:4]):
            x = 15 * mm + i * (box_w + 5 * mm)
            c.setFillColor(_LIGHT)
            c.rect(x, y - 20 * mm, box_w, 20 * mm, fill=1, stroke=0)
            c.setFillColor(_ACCENT_DARK)
            c.setFont("Helvetica-Bold", 15)
            c.drawCentredString(x + box_w / 2, y - 9 * mm, _safe(str(s.get("value", "")))[:18])
            c.setFillColor(_GREY)
            c.setFont("Helvetica", 8)
            c.drawCentredString(x + box_w / 2, y - 15 * mm, _safe(str(s.get("label", "")))[:28])
        y -= 28 * mm

    # --- Secciones ---
    max_w = page_w - 30 * mm
    for section in sections:
        stitle = str(section.get("title", ""))
        items = section.get("items", []) or []
        lines: list[tuple[str, str]] = []
        for item in items:
            for j, line in enumerate(_wrap(str(item), "Helvetica", 10, max_w - 14 * mm)):
                lines.append((("· " if j == 0 else "  "), line))
        card_h = 12 * mm + len(lines) * 5 * mm + 6 * mm

        if y - card_h < 15 * mm:
            c.showPage()
            y = page_h - 15 * mm

        c.setFillColor(colors.white)
        c.setStrokeColor(_ACCENT)
        c.roundRect(15 * mm, y - card_h, max_w, card_h, 4, fill=0, stroke=1)
        c.setFillColor(_ACCENT)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(19 * mm, y - 10 * mm, _safe(stitle))
        c.setFillColor(_GREY)
        c.setFont("Helvetica", 10)
        ty = y - 17 * mm
        for bullet, line in lines:
            c.drawString(19 * mm, ty, bullet)
            c.drawString(26 * mm, ty, line)
            ty -= 5 * mm
        y -= card_h + 8 * mm

    c.showPage()
    c.save()
    return buffer.getvalue()
