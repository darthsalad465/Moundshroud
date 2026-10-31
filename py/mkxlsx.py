"""Builds a tidy .xlsx from JSON: {"title": str, "columns": [str], "rows": [[cell]], "sum_columns": [str], "out": path}.
Header row is styled, columns are sized, the header is frozen, and SUM formulas are added for the requested columns."""
import json
import re
import sys

import xlsxwriter


def number(v):
    """Returns (value, kind) where kind is 'num', 'money', 'pct' or None."""
    if isinstance(v, bool):
        return None, None
    if isinstance(v, (int, float)):
        return float(v), "num"
    s = str(v).strip()
    m = re.fullmatch(r"\(?-?\$?\s*-?[\d,]*\.?\d+\)?%?", s)
    if not m or not re.search(r"\d", s):
        return None, None
    neg = s.startswith("(") or s.startswith("-") or "-$" in s
    n = float(re.sub(r"[^\d.]", "", s) or 0)
    n = -n if neg else n
    if s.endswith("%"):
        return n / 100.0, "pct"
    return n, ("money" if "$" in s else "num")


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    cols = [str(c)[:40] for c in (spec.get("columns") or [])] or ["Item"]
    rows = [r for r in (spec.get("rows") or []) if isinstance(r, list)][:500]
    wb = xlsxwriter.Workbook(spec["out"])
    name = re.sub(r"[\[\]:*?/\\]", " ", str(spec.get("title") or "Sheet"))[:31].strip() or "Sheet"
    ws = wb.add_worksheet(name)
    head = wb.add_format({"bold": True, "font_color": "#FFFFFF", "bg_color": "#5B4FCF", "border": 1, "border_color": "#D0D0E0", "valign": "vcenter"})
    text = wb.add_format({"border": 1, "border_color": "#E3E3EE"})
    fmts = {
        "num": wb.add_format({"num_format": "#,##0.##", "border": 1, "border_color": "#E3E3EE"}),
        "money": wb.add_format({"num_format": "$#,##0.00", "border": 1, "border_color": "#E3E3EE"}),
        "pct": wb.add_format({"num_format": "0.#%", "border": 1, "border_color": "#E3E3EE"}),
    }
    tot_lbl = wb.add_format({"bold": True, "top": 2, "bg_color": "#EEF0FA"})
    tot = {k: wb.add_format({"bold": True, "top": 2, "bg_color": "#EEF0FA", "num_format": f}) for k, f in (("num", "#,##0.##"), ("money", "$#,##0.00"), ("pct", "0.#%"))}

    colkind = {}
    for ci in range(len(cols)):
        kinds = [number(r[ci])[1] for r in rows if ci < len(r) and str(r[ci]).strip() != ""]
        kinds = [k for k in kinds if k]
        if kinds and len(kinds) >= max(1, int(0.6 * len([r for r in rows if ci < len(r)]))):
            colkind[ci] = "money" if "money" in kinds else ("pct" if "pct" in kinds and "num" not in kinds else "num")
    widths = [len(c) + 4 for c in cols]
    for ci, c in enumerate(cols):
        ws.write(0, ci, c, head)
    for ri, r in enumerate(rows, start=1):
        for ci in range(len(cols)):
            v = r[ci] if ci < len(r) else ""
            n, k = number(v) if ci in colkind else (None, None)
            if n is not None:
                ws.write_number(ri, ci, n, fmts[colkind[ci]])
                widths[ci] = max(widths[ci], len(f"{n:,.2f}") + 2)
            else:
                ws.write(ri, ci, "" if v is None else str(v), text)
                widths[ci] = max(widths[ci], min(48, len(str(v)) + 2))
    sums = [str(s).strip().lower() for s in (spec.get("sum_columns") or [])]
    if rows and sums:
        tr = len(rows) + 1
        ws.write(tr, 0, "Total", tot_lbl)
        for ci, c in enumerate(cols):
            if ci == 0:
                continue
            if c.strip().lower() in sums and ci in colkind:
                col = xlsxwriter.utility.xl_col_to_name(ci)
                cached = sum((number(r[ci])[0] or 0) for r in rows if ci < len(r))
                ws.write_formula(tr, ci, f"=SUM({col}2:{col}{tr})", tot[colkind[ci]], cached)
            else:
                ws.write(tr, ci, "", tot_lbl)
    for ci, w in enumerate(widths):
        ws.set_column(ci, ci, min(52, max(10, w)))
    ws.set_row(0, 22)
    ws.freeze_panes(1, 0)
    wb.close()


main()
