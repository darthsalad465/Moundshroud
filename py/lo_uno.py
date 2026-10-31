# Moundshroud <-> LibreOffice bridge. Runs with LibreOffice's own Python and talks to a headless LibreOffice over its automation (UNO) socket.
# usage: python lo_uno.py <port> <request.json> <response.json>
# Requests: read / write / new. Everything is done on the real document through LibreOffice, so formatting, images, charts and macros survive.
import sys, os, json, time, base64, tempfile, traceback
import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.connection import NoConnectException

def pv(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

def connect(port):
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    url = "uno:socket,host=127.0.0.1,port=%d;urp;StarOffice.ComponentContext" % port
    last = None
    for _ in range(90):
        try:
            return resolver.resolve(url)
        except NoConnectException as e:
            last = e; time.sleep(0.5)
    raise last

def kind_of(doc):
    if doc.supportsService("com.sun.star.text.TextDocument"): return "writer"
    if doc.supportsService("com.sun.star.sheet.SpreadsheetDocument"): return "calc"
    if doc.supportsService("com.sun.star.presentation.PresentationDocument"): return "impress"
    if doc.supportsService("com.sun.star.drawing.DrawingDocument"): return "draw"
    return "other"

def load(desktop, path, readonly):
    url = uno.systemPathToFileUrl(os.path.abspath(path))
    doc = desktop.loadComponentFromURL(url, "_blank", 0, (pv("Hidden", True), pv("ReadOnly", bool(readonly)), pv("UpdateDocMode", 0)))
    if doc is None: raise Exception("LibreOffice could not open that file")
    return doc

# ---------------------------------------------------------------- Writer
def text_of(el):
    try: return el.getString()
    except Exception: return ""

def read_writer(doc):
    blocks = []; enum = doc.Text.createEnumeration(); styles = set()
    while enum.hasMoreElements():
        el = enum.nextElement(); i = len(blocks)
        if el.supportsService("com.sun.star.text.Paragraph"):
            s = el.ParaStyleName; styles.add(s)
            blocks.append({"k": "p", "i": i, "t": text_of(el), "s": s})
        elif el.supportsService("com.sun.star.text.TextTable"):
            rows = min(el.getRows().getCount(), 80); cols = min(el.getColumns().getCount(), 30); cells = []
            for r in range(rows):
                row = []
                for c in range(cols):
                    try: row.append(el.getCellByPosition(c, r).getString())
                    except Exception: row.append("")
                cells.append(row)
            blocks.append({"k": "t", "i": i, "name": el.getName(), "cells": cells, "rows": el.getRows().getCount(), "cols": el.getColumns().getCount()})
        else:
            blocks.append({"k": "x", "i": i})
    pstyles = []
    try:
        fam = doc.StyleFamilies.getByName("ParagraphStyles")
        for n in ("Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "Heading 4", "Text Body", "Body Text", "Default Paragraph Style", "Quotations", "List Bullet", "List Number"):
            if fam.hasByName(n) and n not in pstyles: pstyles.append(n)
    except Exception: pass
    for s in sorted(styles):
        if s not in pstyles: pstyles.append(s)
    pages = 0
    try: pages = doc.getCurrentController().PageCount
    except Exception: pass
    return {"blocks": blocks, "styles": pstyles, "words": sum(len(b.get("t", "").split()) for b in blocks if b["k"] == "p")}

def write_writer(doc, blocks):
    enum = doc.Text.createEnumeration(); els = []
    while enum.hasMoreElements(): els.append(enum.nextElement())
    txt = doc.Text; kept = set(); prev = None; prev_is_table = False
    def is_par(e): return e.supportsService("com.sun.star.text.Paragraph")
    for b in blocks:
        o = b.get("o")
        if o is not None and 0 <= o < len(els):
            el = els[o]; kept.add(o)
            if b["k"] == "p" and is_par(el):
                if text_of(el) != b["t"]: el.setString(b["t"])
                if b.get("s") and el.ParaStyleName != b["s"]:
                    try: el.ParaStyleName = b["s"]
                    except Exception: pass
                prev = el; prev_is_table = False
            elif b["k"] == "t" and el.supportsService("com.sun.star.text.TextTable"):
                for r, row in enumerate(b.get("cells", [])):
                    for c, v in enumerate(row):
                        try:
                            cell = el.getCellByPosition(c, r)
                            if cell.getString() != v: cell.setString(v)
                        except Exception: pass
                prev = el; prev_is_table = True
            else:
                prev = el; prev_is_table = not is_par(el)
        elif b["k"] == "p":
            if prev is None:
                cur = txt.createTextCursorByRange(txt.getStart())
                cur.setString(b["t"]); txt.insertControlCharacter(cur, 0, False)
                cur.gotoPreviousParagraph(False)
            elif not prev_is_table:
                cur = txt.createTextCursorByRange(prev.getEnd())
                txt.insertControlCharacter(cur, 0, False)
                cur.setString(b["t"])
            else:
                nxt = None
                for j in range(len(els)):
                    if els[j] is prev:
                        for k in range(j + 1, len(els)):
                            if is_par(els[k]): nxt = els[k]; break
                        break
                if nxt is None: continue
                cur = txt.createTextCursorByRange(nxt.getStart())
                cur.setString(b["t"]); txt.insertControlCharacter(cur, 0, False)
                cur.gotoPreviousParagraph(False)
            try:
                if b.get("s"): cur.ParaStyleName = b["s"]
            except Exception: pass
            prev = cur; prev_is_table = False
    for i in range(len(els) - 1, -1, -1):
        if i in kept: continue
        el = els[i]
        if is_par(el):
            try:
                cur = txt.createTextCursorByRange(el.getStart()); cur.gotoEndOfParagraph(True)
                cur.setString("")
                cur.goRight(1, True); cur.setString("")
            except Exception: pass

# ---------------------------------------------------------------- Calc
def read_calc(doc, limit_rows=300, limit_cols=40):
    out = []; sheets = doc.getSheets()
    for si in range(sheets.getCount()):
        sh = sheets.getByIndex(si); cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
        a = cur.getRangeAddress(); rows = a.EndRow + 1; cols = a.EndColumn + 1; full = (rows, cols)
        rows = max(1, min(rows, limit_rows)); cols = max(1, min(cols, limit_cols))
        rng = sh.getCellRangeByPosition(0, 0, cols - 1, rows - 1)
        formulas = [list(r) for r in rng.getFormulaArray()]
        data = rng.getDataArray(); vals = []
        small = rows * cols <= 7000
        for r in range(rows):
            row = []
            for c in range(cols):
                v = data[r][c]
                if small and (formulas[r][c] or v != ""):
                    try: v = sh.getCellByPosition(c, r).getString()
                    except Exception: pass
                row.append(v if isinstance(v, str) else (("%g" % v) if isinstance(v, float) else str(v)))
            vals.append(row)
        out.append({"name": sh.getName(), "rows": rows, "cols": cols, "totalRows": full[0], "totalCols": full[1], "f": formulas, "v": vals})
    return {"sheets": out}

def write_calc(doc, edits):
    sheets = doc.getSheets()
    for e in edits:
        op = e.get("op", "cell")
        if op == "addSheet":
            if not sheets.hasByName(e["name"]): sheets.insertNewByName(e["name"], sheets.getCount())
            continue
        if sheets.hasByName(e.get("sheet", "")): sh = sheets.getByName(e["sheet"])
        else: continue
        cell = sh.getCellByPosition(int(e["c"]), int(e["r"])); f = e.get("f", "")
        if f == "": cell.clearContents(1 | 2 | 4 | 16)
        else: cell.setFormula(f)
    try: doc.calculateAll()
    except Exception: pass

# ---------------------------------------------------------------- Impress
def shape_label(sh):
    t = sh.getShapeType().split(".")[-1]
    return {"TitleTextShape": "Title", "OutlinerShape": "Content", "SubtitleShape": "Subtitle", "NotesShape": "Notes", "TextShape": "Text", "CustomShape": "Shape", "RectangleShape": "Shape"}.get(t, t)

def thumb(ctx, page, w=480):
    try:
        f = ctx.ServiceManager.createInstanceWithContext("com.sun.star.drawing.GraphicExportFilter", ctx)
        f.setSourceDocument(page)
        h = max(1, int(w * page.Height / max(1, page.Width)))
        fd = uno.Any("[]com.sun.star.beans.PropertyValue", (pv("PixelWidth", w), pv("PixelHeight", h)))
        tmp = os.path.join(tempfile.gettempdir(), "moundshroud_th_%d.png" % int(time.time() * 1000))
        f.filter((pv("URL", uno.systemPathToFileUrl(tmp)), pv("MediaType", "image/png"), pv("FilterData", fd)))
        with open(tmp, "rb") as fh: b = base64.b64encode(fh.read()).decode("ascii")
        try: os.remove(tmp)
        except Exception: pass
        return b
    except Exception:
        return ""

def read_impress(doc, ctx):
    pages = doc.getDrawPages(); out = []
    for i in range(min(pages.getCount(), 120)):
        pg = pages.getByIndex(i); shapes = []; others = 0
        for j in range(pg.getCount()):
            sh = pg.getByIndex(j)
            try:
                if sh.supportsService("com.sun.star.drawing.Text") and (sh.getString() != "" or shape_label(sh) in ("Title", "Content", "Subtitle")):
                    shapes.append({"j": j, "ty": shape_label(sh), "t": sh.getString()})
                else: others += 1
            except Exception: others += 1
        notes = ""; ni = -1
        try:
            np = pg.getNotesPage()
            for j in range(np.getCount()):
                sh = np.getByIndex(j)
                if sh.getShapeType().endswith("NotesShape"): notes = sh.getString(); ni = j; break
        except Exception: pass
        out.append({"i": i, "shapes": shapes, "others": others, "notes": notes, "ni": ni, "img": thumb(ctx, pg) if i < 60 else ""})
    return {"slides": out}

def write_impress(doc, slides):
    pages = doc.getDrawPages(); orig = [pages.getByIndex(i) for i in range(pages.getCount())]; made = []
    dup = doc  # XDrawPageDuplicator is implemented by the document
    for s in slides:
        if s.get("o") is not None and 0 <= s["o"] < len(orig): pg = orig[s["o"]]
        elif s.get("dupOf") is not None and 0 <= s["dupOf"] < len(orig): pg = dup.duplicate(orig[s["dupOf"]])
        else: pg = None
        made.append(pg)
        if pg is None: continue
        for sh in s.get("shapes", []):
            try:
                el = pg.getByIndex(int(sh["j"]))
                if el.getString() != sh["t"]: el.setString(sh["t"])
            except Exception: pass
        if s.get("ni", -1) is not None and s.get("ni", -1) >= 0 and "notes" in s:
            try:
                np = pg.getNotesPage(); el = np.getByIndex(int(s["ni"]))
                if el.getString() != s["notes"]: el.setString(s["notes"])
            except Exception: pass
    keep = set(id(p) for p in made if p is not None)
    for p in orig:
        if id(p) not in keep:
            try: pages.remove(p)
            except Exception: pass
    # where each requested slide ended up: the caller reorders .pptx files with python-pptx (a hidden LibreOffice has no slide sorter)
    final = doc.getDrawPages(); perm = []
    for p in made:
        if p is None: continue
        pos = -1
        for k in range(final.getCount()):
            if final.getByIndex(k) == p: pos = k; break
        perm.append(pos)
    return perm

FILTERS = {"docx": "MS Word 2007 XML", "xlsx": "Calc MS Excel 2007 XML", "pptx": "Impress MS PowerPoint 2007 XML", "odt": "writer8", "ods": "calc8", "odp": "impress8"}

def main():
    port = int(sys.argv[1]); req = json.load(open(sys.argv[2], encoding="utf-8")); res = {"ok": True}
    try:
        ctx = connect(port); desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        op = req["op"]
        if op == "new":
            fac = {"writer": "private:factory/swriter", "calc": "private:factory/scalc", "impress": "private:factory/simpress"}[req["kind"]]
            doc = desktop.loadComponentFromURL(fac, "_blank", 0, (pv("Hidden", True),))
            try:
                if req["kind"] == "writer" and req.get("title"):
                    doc.Text.setString(req["title"]);
                    cur = doc.Text.createTextCursorByRange(doc.Text.getStart()); cur.gotoEndOfParagraph(False)
                    try: doc.Text.createTextCursorByRange(doc.Text.getStart()).ParaStyleName = "Title"
                    except Exception: pass
                ext = os.path.splitext(req["path"])[1].lstrip(".").lower()
                doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(req["path"])), (pv("FilterName", FILTERS[ext]),))
            finally:
                doc.close(True)
            res["path"] = req["path"]
        elif op == "read":
            doc = load(desktop, req["path"], True)
            try:
                k = kind_of(doc); res["kind"] = k
                if k == "writer": res.update(read_writer(doc))
                elif k == "calc": res.update(read_calc(doc))
                elif k == "impress": res.update(read_impress(doc, ctx))
                else: res["error"] = "That kind of document can not be edited here yet."
            finally:
                doc.close(True)
        elif op == "write":
            doc = load(desktop, req["path"], False)
            try:
                k = kind_of(doc)
                if k == "writer": write_writer(doc, req["blocks"])
                elif k == "calc": write_calc(doc, req["edits"])
                elif k == "impress": res["perm"] = write_impress(doc, req["slides"])
                doc.store()
            finally:
                doc.close(True)
    except Exception as e:
        res = {"ok": False, "error": str(e) or e.__class__.__name__, "trace": traceback.format_exc()[-600:]}
    json.dump(res, open(sys.argv[3], "w", encoding="utf-8"))

main()
