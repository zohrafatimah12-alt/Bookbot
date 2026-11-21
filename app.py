

import os
import pymupdf

from flask import Flask, request, jsonify
from flask_cors import CORS

from stats import (
    get_num_words,
    get_character_count,
    chars_dict_to_sorted_list,
    get_unused_letters
)
from summarizer import summarize

app = Flask(__name__)
CORS(app)

# Maximum upload size: 20 MB
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024


@app.errorhandler(413)
def file_too_large(error):
    # Only affects uploads over the limit: return JSON instead of HTML.
    return jsonify({"error": "File is too large. The maximum size is 20 MB."}), 413


@app.route("/")
def home():
    return "Welcome to BookBot Web!"


@app.route("/analyze", methods=["POST"])
def analyze_file():

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files["file"]

    if uploaded_file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = uploaded_file.filename
    extension = os.path.splitext(filename)[1].lower()

    if extension not in [".txt", ".pdf"]:
        return jsonify({"error": "Only TXT and PDF files are supported"}), 400

    file_bytes = uploaded_file.read()
    file_size = len(file_bytes)

    try:
        if extension == ".txt":
            text = file_bytes.decode("utf-8")

            page_count = None

        else:
            document = pymupdf.open(
                stream=file_bytes,
                filetype="pdf"
            )

            text = ""

            for page in document:
                text += page.get_text()

            page_count = len(document)
            document.close()

    except Exception:
        return jsonify({"error": "Could not read this file"}), 400

    num_words = get_num_words(text)

    char_count = get_character_count(text)

    sorted_chars = chars_dict_to_sorted_list(char_count)

    unused_letters = get_unused_letters(char_count)

    summary_result = summarize(text)

    return jsonify({
        "filename": filename,
        "file_size_bytes": file_size,
        "file_size_kb": round(file_size / 1024, 2),

        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "file_type": extension[1:].upper(),
        "page_count": page_count,
        "word_count": num_words,
        "character_count": sum(char_count.values()),
        "character_frequency": [
            {"character": char, "count": count}
            for char, count in sorted_chars
            if char.isalpha()
        ],
        "unused_letters": unused_letters,

        # Extractive summary (see summarizer.py). `summary` is None when the
        # document has no extractable text.
        "summary": summary_result["text"],
        "summary_sentences": summary_result["sentences"],
        "summary_status": summary_result["status"],
        "total_sentences": summary_result["sentence_count"],
        "key_terms": summary_result["key_terms"]
    })


if __name__ == "__main__":
    app.run(debug=True)
