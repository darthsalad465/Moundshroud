"""PDF text extractor worker. Reads one file path per line on stdin, answers one JSON line per file on stdout."""
import sys, json
from pypdf import PdfReader

for line in sys.stdin:
    p = line.rstrip("\r\n")
    if not p:
        continue
    try:
        r = PdfReader(p)
        if r.is_encrypted:
            try:
                r.decrypt("")
            except Exception:
                pass
        pages = []
        for i, pg in enumerate(r.pages):
            try:
                t = pg.extract_text() or ""
            except Exception:
                t = ""
            if t.strip():
                pages.append({"page": i + 1, "text": t})
        print(json.dumps({"pages": pages}, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)[:200]}), flush=True)
