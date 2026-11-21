#!/bin/bash
# BookBot: one-command setup on PythonAnywhere. Safe to run again at any time.
#   - updates the code from GitHub
#   - creates a virtualenv and installs requirements.txt
#   - checks that Flask + PyMuPDF really work (analyses a generated PDF)
#   - installs the WSGI file, if the web app already exists
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${VENV_DIR:-$HOME/.virtualenvs/bookbot-env}"
cd "$PROJECT_DIR"

echo "== 1/4 Updating code"
git pull --ff-only 2>/dev/null || echo "(skipped git pull)"

echo "== 2/4 Virtualenv"
PY=""
for candidate in python3.13 python3.12 python3.11 python3.10; do
  if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
[ -n "$PY" ] || { echo "ERROR: no suitable Python found"; exit 1; }
if [ ! -x "$VENV_DIR/bin/python" ]; then
  mkdir -p "$(dirname "$VENV_DIR")"
  "$PY" -m venv "$VENV_DIR"
fi
PYVER="$("$VENV_DIR/bin/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
# --no-cache-dir: the free plan has only 512 MB of disk, so don't keep pip's cache.
"$VENV_DIR/bin/pip" install --quiet --no-cache-dir --upgrade pip
"$VENV_DIR/bin/pip" install --quiet --no-cache-dir -r requirements.txt
rm -rf "$HOME/.cache/pip"

echo "== 3/4 Self-test (Flask + PyMuPDF)"
"$VENV_DIR/bin/python" - <<'EOF'
import io, pymupdf
from app import app
doc = pymupdf.open()
doc.new_page().insert_text((72, 72), "BookBot works on this server. Hello from a generated PDF.")
data = doc.tobytes()
client = app.test_client()
reply = client.post("/analyze", data={"file": (io.BytesIO(data), "selftest.pdf")},
                    content_type="multipart/form-data")
body = reply.get_json()
assert reply.status_code == 200 and body["word_count"] == 10 and body["page_count"] == 1, body
print("PyMuPDF", pymupdf.VersionBind, "- PDF analysis OK, words:", body["word_count"])
EOF

echo "== 4/4 WSGI file"
WSGI_TARGET="$(ls /var/www/"${USER:-$(whoami)}"*_wsgi.py 2>/dev/null | head -n 1 || true)"
if [ -n "$WSGI_TARGET" ]; then
  sed "s#__PROJECT_DIR__#$PROJECT_DIR#" pythonanywhere_wsgi.py > "$WSGI_TARGET"
  echo "Installed: $WSGI_TARGET"
else
  echo "No web app yet, so no WSGI file to install. Create the web app, then run this script again."
fi

echo
echo "DONE. Use these values on the Web tab:"
echo "  Python version : $PYVER"
echo "  Source code    : $PROJECT_DIR"
echo "  Virtualenv     : $VENV_DIR"
