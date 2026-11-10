"""Respan Gateway worker: the open-source gateway on a loopback port, for the app's Claude requests.

lib/gateway.js starts this and reads one JSON line - {"url": "http://127.0.0.1:<port>"} - and then sends the
Anthropic Messages requests it already builds to that address. The app's own Anthropic key reaches the gateway
as ANTHROPIC_API_KEY in this process's environment, so neither the gateway nor this file ever writes it to disk.
The process stops (and the gateway with it) when lib/gateway.js closes stdin.
"""
import json
import os
import sys

try:
    import respan_gateway as rg
except Exception as e:                                             # not installed in this Python
    print(json.dumps({"error": "respan-gateway is not installed: " + str(e)[:160]}), flush=True)
    raise SystemExit(2)

# A local provider fixture may be named instead of the real Anthropic API (tests use this, and so does anyone
# pointing the app at their own server): RESPAN_ANTHROPIC_BASE_URL moves Anthropic's address.
base = (os.environ.get("RESPAN_ANTHROPIC_BASE_URL") or "").strip()
if base:
    gateway = rg.Gateway(config={"providers": {"anthropic": {
        "vendor": "anthropic", "key": "env:ANTHROPIC_API_KEY", "base_url": base}}})
else:
    gateway = rg.Gateway()                                        # ./gateway.toml, else the keys in our environment

with gateway as gw:
    with gw.serve(port=0) as server:                               # loopback only; port 0 asks for a free one
        print(json.dumps({"url": server.url}), flush=True)
        try:
            while sys.stdin.readline():                            # held open by lib/gateway.js
                pass
        except (KeyboardInterrupt, OSError):
            pass
