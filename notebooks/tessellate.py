#!/usr/bin/env python3
"""
tessellate.py — Tile an SVG image across a grid of printer sheets for large-format printing.

Usage:
    python tessellate.py <input.svg> <COLSxROWS> <paper> [options]

    paper:  a4 | a3 | a2 | a1 | a0 | letter | legal | tabloid

Options:
    --landscape       Force landscape orientation (default: auto-fit to image ratio)
    --portrait        Force portrait orientation
    --overlap=N       Add N mm bleed on edges shared with adjacent tiles (with cut marks)
    --out=DIR         Output directory (default: <stem>_<grid>_<paper><orient>)

Examples:
    python tessellate.py poster.svg 3x3 a3
    python tessellate.py image.svg 4x2 a4 --landscape
    python tessellate.py art.svg 2x3 a3 --overlap=8 --out=print_tiles
"""

import sys
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

PAPER_MM = {
    'a4':      (210,    297),
    'a3':      (297,    420),
    'a2':      (420,    594),
    'a1':      (594,    841),
    'a0':      (841,   1189),
    'letter':  (215.9,  279.4),
    'legal':   (215.9,  355.6),
    'tabloid': (279.4,  431.8),
}


def col_label(i):
    """Spreadsheet-style column label: 0→A, 1→B, …, 25→Z, 26→AA, …"""
    label = ''
    i += 1
    while i > 0:
        i, r = divmod(i - 1, 26)
        label = chr(65 + r) + label
    return label


def dim_to_px(s):
    """Convert an SVG dimension string to px (96 dpi)."""
    if not s:
        return None
    s = s.strip()
    for unit, factor in [('mm', 96/25.4), ('cm', 96/2.54), ('in', 96),
                         ('pt', 96/72), ('pc', 16), ('px', 1)]:
        if s.endswith(unit):
            return float(s[:-len(unit)]) * factor
    return float(s)


def read_viewbox(path):
    """Return (x, y, w, h) from an SVG's viewBox or width/height attributes."""
    root = ET.parse(path).getroot()
    vb = root.get('viewBox')
    if vb:
        return tuple(float(v) for v in re.split(r'[\s,]+', vb.strip()))
    w = dim_to_px(root.get('width'))
    h = dim_to_px(root.get('height'))
    if w and h:
        return 0.0, 0.0, float(w), float(h)
    sys.exit(f"Cannot read dimensions from {path}. Ensure it has viewBox or width+height.")


def parse_flags(argv):
    flags = {}
    for a in argv:
        k, _, v = a.lstrip('-').partition('=')
        flags[k] = v if v else True
    return flags


def cut_marks_svg(ext_l, ext_r, ext_t, ext_b, canvas_w, canvas_h):
    """Dashed cut lines at the bleed boundaries."""
    style = 'stroke="#777" stroke-width="0.25" fill="none" stroke-dasharray="4,2"'
    lines = []
    if ext_l:
        lines.append(f'<line x1="{ext_l:.3f}" y1="0" x2="{ext_l:.3f}" y2="{canvas_h:.3f}" {style}/>')
    if ext_r:
        x = canvas_w - ext_r
        lines.append(f'<line x1="{x:.3f}" y1="0" x2="{x:.3f}" y2="{canvas_h:.3f}" {style}/>')
    if ext_t:
        lines.append(f'<line x1="0" y1="{ext_t:.3f}" x2="{canvas_w:.3f}" y2="{ext_t:.3f}" {style}/>')
    if ext_b:
        y = canvas_h - ext_b
        lines.append(f'<line x1="0" y1="{y:.3f}" x2="{canvas_w:.3f}" y2="{y:.3f}" {style}/>')
    return '\n  '.join(lines)


def index_labels_svg(r, c, rows, cols, ext_l, ext_t, pw, ph):
    """
    Spreadsheet-style row/column index labels printed in the tile margins.
    Column letter centred at the top edge, row number centred at the left edge,
    cell reference (e.g. B2) in the bottom-left corner.
    """
    cx   = col_label(c)
    font = 'font-family="monospace" font-size="3.5" fill="#aaa"'

    # Cell reference — bottom-left of printable area
    lx = ext_l + 2
    ly = ext_t + ph - 2.5
    cell_ref = f'<text x="{lx:.2f}" y="{ly:.2f}" {font}>{cx}{r+1} / {cols}×{rows}</text>'

    # Column letter — top centre of printable area
    cx_pos = ext_l + pw / 2
    cy_pos = ext_t + 5.5
    col_lbl = f'<text x="{cx_pos:.2f}" y="{cy_pos:.2f}" text-anchor="middle" {font}>{cx}</text>'

    # Row number — left centre of printable area, rotated
    rx = ext_l + 5.5
    ry = ext_t + ph / 2
    row_lbl = (f'<text x="{rx:.2f}" y="{ry:.2f}" text-anchor="middle" {font}'
               f' transform="rotate(-90 {rx:.2f} {ry:.2f})">{r+1}</text>')

    return f'  {cell_ref}\n  {col_lbl}\n  {row_lbl}'


def main():
    argv = sys.argv[1:]
    if not argv or '-h' in argv or '--help' in argv:
        print(__doc__)
        sys.exit(0)
    if len(argv) < 3:
        sys.exit("Need <svg> <COLxROW> <paper>. Try --help.")

    src = Path(argv[0])
    if not src.exists():
        sys.exit(f"File not found: {src}")

    m = re.fullmatch(r'(\d+)[xX](\d+)', argv[1])
    if not m:
        sys.exit(f"Bad grid '{argv[1]}' — use e.g. 3x3 or 4x2")
    cols, rows = int(m.group(1)), int(m.group(2))

    paper = argv[2].lower()
    if paper not in PAPER_MM:
        sys.exit(f"Unknown paper '{paper}'. Options: {', '.join(PAPER_MM)}")
    pw, ph = PAPER_MM[paper]

    flags = parse_flags(argv[3:])

    vx, vy, vw, vh = read_viewbox(src)

    # Orientation: auto-detect by matching image aspect ratio to grid
    if 'landscape' in flags:
        pw, ph = max(pw, ph), min(pw, ph)
    elif 'portrait' in flags:
        pw, ph = min(pw, ph), max(pw, ph)
    else:
        img_ar       = vw / vh
        portrait_ar  = (pw * cols) / (ph * rows)
        landscape_ar = (ph * cols) / (pw * rows)
        if abs(img_ar - landscape_ar) < abs(img_ar - portrait_ar):
            pw, ph = ph, pw

    overlap = float(flags.get('overlap', 0))
    orient  = 'landscape' if pw > ph else 'portrait'

    tag     = f"{cols}x{rows}_{paper}{'L' if pw > ph else 'P'}"
    out_dir = Path(flags.get('out', f"{src.stem}_{tag}"))
    out_dir.mkdir(parents=True, exist_ok=True)

    # Copy source SVG so tile hrefs stay self-contained in the output dir
    shutil.copy2(src, out_dir / src.name)

    total_w = cols * pw   # full poster width mm
    total_h = rows * ph   # full poster height mm

    print(f"Input   : {src}  (viewBox {vw:.0f}×{vh:.0f} user units)")
    print(f"Grid    : {cols} cols × {rows} rows  →  {cols*rows} sheets")
    print(f"Paper   : {paper.upper()} {orient}  ({pw}×{ph} mm)")
    if overlap:
        print(f"Overlap : {overlap} mm bleed on shared edges")
    print(f"Output  : {out_dir}/\n")

    for r in range(rows):
        for c in range(cols):
            # Bleed extension per edge — only between tiles, not at poster border
            ext_l = overlap if c > 0       else 0.0
            ext_r = overlap if c < cols-1  else 0.0
            ext_t = overlap if r > 0       else 0.0
            ext_b = overlap if r < rows-1  else 0.0

            canvas_w = pw + ext_l + ext_r
            canvas_h = ph + ext_t + ext_b

            # Position the full poster image so that tile (r,c)'s content
            # sits inside the printable area, shifted inward by the bleed.
            img_x = -(c * pw) + ext_l
            img_y = -(r * ph) + ext_t

            marks  = cut_marks_svg(ext_l, ext_r, ext_t, ext_b, canvas_w, canvas_h)
            labels = index_labels_svg(r, c, rows, cols, ext_l, ext_t, pw, ph)

            svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_w}mm" height="{canvas_h}mm" viewBox="0 0 {canvas_w} {canvas_h}">
  <!-- tile {col_label(c)}{r+1} ({r+1}×{c+1} of {rows}×{cols}) — tessellate.py -->
  <image xlink:href="{src.name}" href="{src.name}"
         x="{img_x:.4f}" y="{img_y:.4f}"
         width="{total_w:.4f}" height="{total_h:.4f}"
         preserveAspectRatio="xMidYMid meet"/>
  {marks}
{labels}
</svg>'''

            fname = out_dir / f'tile_{r+1:02d}_{col_label(c)}.svg'
            fname.write_text(svg, encoding='utf-8')
            print(f"  {fname.name}  ({canvas_w:.1f}×{canvas_h:.1f} mm)")

    # Assembly map
    print(f"\n{rows*cols} tiles → {out_dir}/")
    print("\nAssembly layout:")
    header = "      " + "".join(f"  {col_label(c):^5}" for c in range(cols))
    print(header)
    print("      " + "-" * (7 * cols + 1))
    for r in range(rows):
        cells = "".join(f" [{col_label(c)}{r+1}] " for c in range(cols))
        print(f"  {r+1:2d}  |{cells}")

    if overlap:
        print(f"\nCut along dashed lines ({overlap} mm bleed) before assembling.")
    print("Open tiles in Inkscape → File > Print, or batch-export to PDF for a print shop.")


if __name__ == '__main__':
    main()
