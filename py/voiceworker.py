"""Speech-to-text worker (whisper.cpp via pywhispercpp). Model path is argv[1].
Reads one wav path per line on stdin, answers one JSON line per file on stdout."""
import sys, json
from pywhispercpp.model import Model

m = Model(sys.argv[1], n_threads=4, print_realtime=False, print_progress=False, print_timestamps=False)
print(json.dumps({"ready": True}), flush=True)
for line in sys.stdin:
    p = line.rstrip("\r\n")
    if not p:
        continue
    try:
        segs = m.transcribe(p)
        print(json.dumps({"text": " ".join(s.text.strip() for s in segs).strip()}, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)[:200]}), flush=True)
