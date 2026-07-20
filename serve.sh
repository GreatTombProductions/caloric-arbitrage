#!/usr/bin/env bash
# Serve this exact Pages-layout static tree with PMTiles byte-range support.
# Open http://localhost:8765/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
echo "Serving Caloric Arbitrage at http://localhost:8765/"

exec python3 - <<'PY'
import http.server
import os
import shutil


class RangeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    _range = None

    def send_head(self):
        self._range = None
        path = self.translate_path(self.path)
        range_header = self.headers.get("Range")
        if not range_header or not os.path.isfile(path):
            return super().send_head()

        try:
            unit, specification = range_header.split("=", 1)
            if unit.strip().lower() != "bytes" or "," in specification:
                raise ValueError("unsupported range")
            start_text, end_text = specification.strip().split("-", 1)
            size = os.path.getsize(path)
            if start_text:
                start = int(start_text)
                end = int(end_text) if end_text else size - 1
            else:
                suffix = int(end_text)
                if suffix <= 0:
                    raise ValueError("invalid suffix")
                start = max(0, size - suffix)
                end = size - 1
            if start < 0 or start >= size or end < start:
                raise ValueError("unsatisfiable range")
            end = min(end, size - 1)
        except (TypeError, ValueError):
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{os.path.getsize(path)}")
            self.end_headers()
            return None

        stream = open(path, "rb")
        stream.seek(start)
        self._range = (start, end)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        return stream

    def copyfile(self, source, outputfile):
        if self._range is None:
            return shutil.copyfileobj(source, outputfile)
        start, end = self._range
        remaining = end - start + 1
        while remaining:
            chunk = source.read(min(64 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)


http.server.ThreadingHTTPServer(("127.0.0.1", 8765), RangeHTTPRequestHandler).serve_forever()
PY
