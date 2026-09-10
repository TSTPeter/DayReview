#!/usr/bin/env python3
"""
Serve web/ for local use.

    python3 serve.py            then open http://localhost:8000

Why a server at all, for an app with no back end: ES modules and service workers both
refuse to run from file:// URLs. localhost counts as a secure context, so the service
worker registers and the app works offline from the second load onwards.

This serves static files and nothing else. There is no API, no database and no network
call to anywhere. Everything the child types stays in her browser's IndexedDB on this
device, which is what makes the scope decision in docs/06 hold.
"""
import argparse
import functools
import http.server
import pathlib
import socketserver

ROOT = pathlib.Path(__file__).resolve().parent / "web"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".json": "application/json"}

    def end_headers(self):
        # No caching in development: the service worker is quite enough of that.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    if not (ROOT / "data" / "words.json").exists():
        raise SystemExit("web/data/words.json missing. Run: python3 engine/export.py")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", args.port), functools.partial(Handler, directory=str(ROOT))) as httpd:
        print(f"serving {ROOT} at http://localhost:{args.port}  (ctrl-c to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            # Ctrl-C is how you stop this. It is not a crash, so do not print
            # eight frames of socketserver internals as though it were one.
            print("\nstopped.")
