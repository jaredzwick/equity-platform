#!/usr/bin/env python3
"""Render guide-source.md into a publication-quality PDF for the lead magnet.

Matches the visual language of the reference OE guide: dark-teal H1/H2, sans body,
generous line-height, 1in margins. Output ships at
landing/public/guides/90-day-acquisition-playbook.pdf.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from fpdf import FPDF

# Match the reference guide's teal-ish heading color (extracted by eye from the OE
# reference: RGB roughly (30, 100, 130)).
HEADING_RGB = (30, 100, 130)
BODY_RGB = (30, 30, 30)
MUTED_RGB = (120, 120, 120)

SRC = Path(__file__).parent / "guide-source.md"
OUT = Path(__file__).parent.parent / "public" / "guides" / "90-day-acquisition-playbook.pdf"


class GuidePDF(FPDF):
    """Small FPDF subclass with a running footer + first-page cover."""

    def footer(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(-15)
        self.set_font("Helvetica", size=8)
        self.set_text_color(*MUTED_RGB)
        self.cell(0, 8, f"lamboapp.com  ·  {self.page_no() - 1}", align="C")


def render() -> None:
    if not SRC.exists():
        sys.exit(f"missing source: {SRC}")

    OUT.parent.mkdir(parents=True, exist_ok=True)

    pdf = GuidePDF(format="Letter", unit="pt")
    pdf.set_auto_page_break(auto=True, margin=72)
    pdf.set_margins(left=72, top=72, right=72)
    pdf.add_page()

    lines = SRC.read_text(encoding="utf-8").splitlines()
    # First H1 becomes the cover; everything after renders inline.
    i = 0
    while i < len(lines) and not lines[i].startswith("# "):
        i += 1
    if i >= len(lines):
        sys.exit("no H1 found")

    title = lines[i][2:].strip()
    i += 1

    # Cover: big title, small subtitle, then a soft rule.
    pdf.set_font("Helvetica", "B", size=26)
    pdf.set_text_color(*HEADING_RGB)
    # Convert curly apostrophes fpdf's default core font can't encode.
    pdf.multi_cell(0, 32, _ascii_safe(title))
    pdf.ln(6)
    pdf.set_font("Helvetica", size=11)
    pdf.set_text_color(*MUTED_RGB)
    pdf.cell(0, 14, "A lamboapp.com field guide.")
    pdf.ln(28)
    _hr(pdf)
    pdf.ln(6)

    _render_body(pdf, lines[i:])
    pdf.output(str(OUT))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


def _render_body(pdf: FPDF, lines: list[str]) -> None:
    para_buf: list[str] = []
    bullets_buf: list[str] = []

    def flush_para() -> None:
        if not para_buf:
            return
        text = " ".join(para_buf).strip()
        para_buf.clear()
        if not text:
            return
        pdf.set_font("Helvetica", size=11)
        pdf.set_text_color(*BODY_RGB)
        # Render bold spans (**text**) inline. fpdf2 doesn't have markdown
        # support out of the box, so split on ** and toggle font.
        _write_inline(pdf, text)
        pdf.ln(6)

    def flush_bullets() -> None:
        if not bullets_buf:
            return
        pdf.set_font("Helvetica", size=11)
        pdf.set_text_color(*BODY_RGB)
        for b in bullets_buf:
            _bullet(pdf, b)
        bullets_buf.clear()
        pdf.ln(4)

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("## "):
            flush_para()
            flush_bullets()
            pdf.ln(6)
            pdf.set_font("Helvetica", "B", size=15)
            pdf.set_text_color(*HEADING_RGB)
            pdf.multi_cell(0, 22, _ascii_safe(line[3:].strip()))
            pdf.ln(4)
            continue
        if line.startswith("# "):
            flush_para()
            flush_bullets()
            continue
        if line.startswith("- "):
            flush_para()
            bullets_buf.append(line[2:].strip())
            continue
        if not line.strip():
            flush_para()
            flush_bullets()
            continue
        para_buf.append(line)

    flush_para()
    flush_bullets()


def _write_inline(pdf: FPDF, text: str) -> None:
    """Line-wrap a paragraph honoring **bold** toggles. Uses fpdf.write() so
    words break naturally at the right margin without me computing widths."""
    parts = re.split(r"(\*\*)", _ascii_safe(text))
    bold = False
    pdf.set_font("Helvetica", size=11)
    for part in parts:
        if part == "**":
            bold = not bold
            pdf.set_font("Helvetica", "B" if bold else "", size=11)
            continue
        if not part:
            continue
        pdf.write(15, part)
    pdf.ln()


def _bullet(pdf: FPDF, text: str) -> None:
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(14, 15, "-")
    pdf.set_x(pdf.l_margin + 14)
    # Bold the label before the em-dash if the bullet uses a **Label** prefix.
    _write_inline(pdf, text)


def _hr(pdf: FPDF) -> None:
    pdf.set_draw_color(200, 200, 200)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)


def _ascii_safe(s: str) -> str:
    """Replace unicode fpdf's core Helvetica can't encode."""
    return (
        s.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2026", "...")
        .replace("\u00d7", "x")
        .replace("\u2265", ">=")
        .replace("\u2264", "<=")
        .replace("\u2022", "-")
        .replace("\u00a0", " ")
    )


if __name__ == "__main__":
    render()
