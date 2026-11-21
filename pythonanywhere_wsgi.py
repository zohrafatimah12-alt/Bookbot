# WSGI entry point for PythonAnywhere.
# deploy_pythonanywhere.sh copies this file to the place PythonAnywhere reads
# it from, filling in the project folder automatically.
import os
import sys

PROJECT_DIR = "__PROJECT_DIR__"

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Websites allowed to call the API (comma-separated, no trailing slash).
os.environ.setdefault("FRONTEND_ORIGINS", "https://bookbot-frontend-eight.vercel.app")

from app import app as application  # noqa: E402
