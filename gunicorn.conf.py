# Production settings, picked up automatically by `gunicorn app:app`.
import os

# Render provides the port in $PORT and needs the app on 0.0.0.0.
bind = "0.0.0.0:" + os.environ.get("PORT", "8000")

# Free instances have 512 MB RAM: one worker, a few threads.
workers = 1
threads = 4

# Large PDFs can take a while; the default 30 s would kill the request.
timeout = 120
