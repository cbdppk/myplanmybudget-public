#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

PAGE_W = 612
PAGE_H = 792
MARGIN_X = 54
MARGIN_TOP = 736
MARGIN_BOTTOM = 54
LINE_GAP = 15


def esc(text: str) -> str:
    return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def wrap(text: str, width: int = 92) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines: list[str] = []
    cur = words[0]
    for w in words[1:]:
        candidate = f"{cur} {w}"
        if len(candidate) <= width:
            cur = candidate
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def parse_markdown(md_text: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for raw in md_text.splitlines():
        line = raw.rstrip()
        if not line:
            out.append(("body", ""))
            continue
        if line.startswith("# "):
            out.append(("title", line[2:].strip()))
            continue
        if line.startswith("## "):
            out.append(("h2", line[3:].strip()))
            continue
        if line.startswith("- "):
            out.append(("bullet", line[2:].strip()))
            continue
        out.append(("body", line))
    return out


def render_pages(items: list[tuple[str, str]]) -> list[str]:
    pages: list[list[str]] = [[]]
    y = MARGIN_TOP

    def add_line(font: str, size: int, text: str):
        nonlocal y
        if y < MARGIN_BOTTOM:
            pages.append([])
            y = MARGIN_TOP
        pages[-1].append(f"BT /{font} {size} Tf 1 0 0 1 {MARGIN_X} {int(y)} Tm ({esc(text)}) Tj ET")
        y -= LINE_GAP

    for kind, text in items:
        if kind == "title":
            y -= 4
            for line in wrap(text, 60):
                add_line("F2", 20, line)
            y -= 4
        elif kind == "h2":
            y -= 2
            for line in wrap(text, 75):
                add_line("F2", 13, line)
            y -= 2
        elif kind == "bullet":
            wrapped = wrap(text, 84)
            if wrapped:
                add_line("F1", 11, f"- {wrapped[0]}")
                for cont in wrapped[1:]:
                    add_line("F1", 11, f"  {cont}")
        elif kind == "body":
            if text == "":
                y -= 6
            else:
                for line in wrap(text, 92):
                    add_line("F1", 11, line)

    streams: list[str] = []
    for idx, lines in enumerate(pages, start=1):
        body = "\n".join(lines + [f"BT /F1 9 Tf 1 0 0 1 {PAGE_W - 90} 32 Tm (Page {idx}) Tj ET"])
        streams.append(body)
    return streams


def build_pdf(streams: list[str]) -> bytes:
    objs: list[bytes] = []

    def add(obj: str) -> int:
        objs.append(obj.encode("latin-1"))
        return len(objs)

    font_regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font_bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    page_ids = []

    for s in streams:
        content_id = add(f"<< /Length {len(s.encode('latin-1'))} >>\nstream\n{s}\nendstream")
        page_id = add(
            "<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_regular} 0 R /F2 {font_bold} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )
        page_ids.append(page_id)

    kids = " ".join(f"{p} 0 R" for p in page_ids)
    pages_id = add(f"<< /Type /Pages /Count {len(page_ids)} /Kids [ {kids} ] >>")

    for pid in page_ids:
        objs[pid - 1] = objs[pid - 1].replace(b"/Parent 0 0 R", f"/Parent {pages_id} 0 R".encode("latin-1"))

    catalog_id = add(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objs, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode("latin-1"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objs) + 1}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    out.extend(
        (
            "trailer\n"
            f"<< /Size {len(objs) + 1} /Root {catalog_id} 0 R >>\n"
            "startxref\n"
            f"{xref_pos}\n"
            "%%EOF\n"
        ).encode("latin-1")
    )
    return bytes(out)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    source = root / "docs" / "pfs-ARCHITECTURE.md"
    target = root / "docs" / "pfs-ARCHITECTURE.pdf"

    items = parse_markdown(source.read_text(encoding="utf-8"))
    streams = render_pages(items)
    pdf = build_pdf(streams)
    target.write_bytes(pdf)
    print(f"Wrote {target}")


if __name__ == "__main__":
    main()
