# BookBot

BookBot is my first [Boot.dev](https://www.boot.dev) project, now with a web
interface. Upload a **TXT** or **PDF** and BookBot reports word and character
counts, letter frequency, unused letters and an **extractive summary**.

```
bookbot/
├── app.py            Flask API  (POST /analyze)
├── stats.py          counting helpers (words, letters, unused letters)
├── summarizer.py     extractive summary (new)
├── main.py           original command-line version (unchanged)
├── requirements.txt  Flask, flask-cors, pymupdf, gunicorn
├── gunicorn.conf.py  production server settings (port, timeout)
├── render.yaml       Render deployment blueprint (backend)
├── books/            sample texts
└── frontend/
    ├── index.html    both "pages": upload view + report view
    ├── css/style.css   base look + upload page
    ├── css/report.css  the report ("plates")
    ├── js/config.js    API address and limits (20 MB, .txt/.pdf)
    ├── js/app.js       drag & drop, validation, upload, view switching
    ├── js/report.js    turns the JSON into the report
    └── assets/         logo.svg, favicon.svg
```

## Run it (Ubuntu / WSL, two terminals)

Terminal 1 — backend (port 5000):

```bash
cd ~/workspace/bootdotdev/bookbot
python3 -m venv .venv            # only the first time
source .venv/bin/activate
pip install -r requirements.txt  # only the first time
python app.py
```

Terminal 2 — frontend (port 8000):

```bash
cd ~/workspace/bootdotdev/bookbot/frontend
python3 -m http.server 8000
```

Open <http://localhost:8000> in your browser. In Zed, open the `bookbot`
folder and use **View → Terminal** (`` ctrl-` ``); split it to get two terminals.

## How it works

1. **Upload.** `app.js` validates the file (extension, not empty, ≤ 20 MB) and
   sends it as `multipart/form-data` in a field named `file` using
   `XMLHttpRequest` (chosen because it reports upload progress).
2. **Flask.** `/analyze` reads the file into memory, extracts text (UTF-8 for
   TXT, PyMuPDF for PDF), counts words and letters, and calls `summarize()`.
   Nothing is written to disk.
3. **JSON.** The response contains: `filename, file_type, file_size_bytes,
   file_size_kb, file_size_mb, page_count (null for TXT), word_count,
   character_count, character_frequency, unused_letters` and the new
   `summary, summary_sentences, summary_status, total_sentences, key_terms`.
4. **Report.** `report.js` builds the report from that JSON only. Percentages
   and the letter total are calculated from `character_frequency`.
   `character_count` counts *every* character; the chart counts *letters only*.

## How the summary works (`summarizer.py`)

It is *extractive*: it never writes new text, it selects sentences.

1. Clean the text (re-join lines broken by PDFs).
2. Split into sentences (aware of "Mr.", "Dr." …).
3. Score words: frequent non-stopwords are the document's topics.
4. Score sentences: average topic weight, penalising quotes and very short ones.
5. Pick the best, skipping near-duplicates and spreading picks across the
   beginning, middle and end; show them in original order.

No text → `summary` is `null` and `summary_status` is `"no_text"`.

## Changes to the original backend

- `app.py`: imports `summarize`, adds the summary fields to the response, and a
  `413` handler that returns JSON for files over 20 MB. All existing routes and
  fields are unchanged.
- New: `summarizer.py`, `requirements.txt`.

## Deploying online

The site runs in two places: the **frontend** on Vercel (static files) and
the **backend** (Flask) on Render. The browser loads the page from Vercel and
sends the uploaded file straight to Render.

### 1. Backend on Render

1. Push this repository to GitHub.
2. In Render: **New + → Blueprint**, connect the `Bookbot` repository.
   Render reads `render.yaml` and creates the `bookbot-api` web service
   (free plan, build `pip install -r requirements.txt`, start `gunicorn app:app`).
3. `FRONTEND_ORIGINS` is already set to `https://bookbot-frontend-eight.vercel.app`.
   To allow more sites (for example a custom domain), edit it in
   *Render → bookbot-api → Environment*, separated by commas, no trailing slash:
   `https://bookbot-frontend-eight.vercel.app,https://www.example.com`
4. When the deploy finishes, copy the service URL
   (like `https://bookbot-api-xxxx.onrender.com`) and check that opening it
   shows "Welcome to BookBot Web!".

### 2. Connect the frontend

1. In `frontend/js/config.js` set `PRODUCTION_API_BASE` to the Render URL
   (no trailing slash).
2. Commit and push. The Vercel project (Root Directory `frontend`) redeploys
   automatically from GitHub. No `vercel.json` is needed: the frontend is plain
   static files.

### Good to know

- **Free Render services sleep** after about 15 minutes without traffic. The
  first upload after a pause can take up to a minute while the server wakes up.
- Uploads are processed in memory and never stored.
- Only the origins in `FRONTEND_ORIGINS` (plus `http://localhost:8000`) can call
  the API from a browser.

## Known limits

- TXT must be UTF-8. Scanned (image-only) PDFs have no text, so the report says so.
- Letter statistics are lowercase and letters-only (that is what the API returns).
- Fonts load from Google Fonts, so the first visit needs internet.
