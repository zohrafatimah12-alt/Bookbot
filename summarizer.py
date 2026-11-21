"""Lightweight extractive summariser for BookBot.

"Extractive" means we never write new sentences. We score every sentence in
the document and return the best ones, word for word, in their original
order. No AI service, no downloads, only the Python standard library.

Steps
-----
1. clean_text()      tidy line breaks (important for PDFs)
2. split_sentences() cut the text into sentences
3. word scores       words that appear often (but are not "the", "and"...)
                     are the document's topic words
4. sentence scores   a sentence is important if it is full of topic words
5. pick_sentences()  take the best, skip near-duplicates, spread the picks
                     across the document, then restore original order
"""

import re
from collections import Counter

STOPWORDS = frozenset("""
a about above after again against all also am an and any are as at be because
been before being below between both but by can cannot could did do does doing
down during each few for from further had has have having he her here hers
herself him himself his how i if in into is it its itself just me more most
my myself no nor not now of off on once only or other our ours ourselves out
over own same she should so some such than that the their theirs them
themselves then there these they this those through to too under until up
very was we were what when where which while who whom why will with would you
your yours yourself yourselves said say says one upon shall may might must
us yet thus though still even ever never much many every
mr mrs miss like first now like well great good little must
""".split())

# Abbreviations that end in a full stop but do not end a sentence.
ABBREVIATIONS = (
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g",
    "i.e", "no", "vol", "fig", "mt", "capt", "col", "gen", "lt", "rev",
)

MIN_WORDS = 7      # shorter sentences are usually headings or fragments
MAX_WORDS = 60     # longer ones are usually run-ons or broken extraction
WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*")


def strip_gutenberg(text):
    """Drop the licence header/footer of Project Gutenberg e-books, if present,
    so the summary describes the book and not its legal notice."""
    start = re.search(r"\*\*\* ?START OF[^\n]*\n", text)
    end = re.search(r"\*\*\* ?END OF", text)
    if start:
        text = text[start.end():end.start() if end and end.start() > start.end() else None]
    return text


def clean_text(text):
    """Join hard-wrapped lines so a sentence is not cut in half."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)        # re-join hyphenated words
    text = re.sub(r"\n\s*\n+", "\u0000", text)           # keep paragraph breaks
    text = re.sub(r"\s*\n\s*", " ", text)                # single newline -> space
    text = text.replace("\u0000", "\n\n")
    return re.sub(r"[ \t ]+", " ", text).strip()


def split_sentences(text):
    """Split on . ! ? followed by a capital letter, respecting abbreviations."""
    sentences = []
    for paragraph in text.split("\n\n"):
        start = 0
        for match in re.finditer(r"[.!?]+[\"'”’)\]]*\s+(?=[\"'“‘(\[]?[A-Z0-9])",
                                 paragraph):
            candidate = paragraph[start:match.end()].strip()
            last_word = re.findall(r"([A-Za-z.]+)[.!?]+[\"'”’)\]]*\s*$",
                                   candidate)
            if last_word and last_word[0].lower().rstrip(".") in ABBREVIATIONS:
                continue                                  # "Mr. Darcy" is not a break
            if len(candidate.split()) == 1 and len(candidate) <= 3:
                continue                                  # initials like "J."
            sentences.append(candidate)
            start = match.end()
        tail = paragraph[start:].strip()
        if tail:
            sentences.append(tail)
    return sentences


def content_words(sentence):
    """Lower-case topic words of a sentence (no stopwords, no tiny words)."""
    return [
        w for w in (m.lower().strip("'’-") for m in WORD_RE.findall(sentence))
        if len(w) > 2 and w not in STOPWORDS
    ]


def is_candidate(sentence):
    words = sentence.split()
    if not (MIN_WORDS <= len(words) <= MAX_WORDS):
        return False
    letters = [c for c in sentence if c.isalpha()]
    if not letters:
        return False
    if sum(c.isupper() for c in letters) / len(letters) > 0.5:
        return False                                      # SHOUTING HEADINGS
    if sum(c.isdigit() for c in sentence) / len(sentence) > 0.2:
        return False                                      # tables / numbers
    return True


def summary_length(sentence_count):
    """3 sentences for short texts, growing slowly up to 7 for books."""
    if sentence_count <= 3:
        return sentence_count
    return max(3, min(7, round(sentence_count ** 0.5 / 4) + 2))


def summarize(text):
    """Return a dict describing the summary of `text`.

    {
      "status":    "ok" | "no_text",
      "text":      "joined summary" | None,
      "sentences": [...],            # the chosen sentences, document order
      "key_terms": [{"term", "count"}, ...],   # top topic words (real counts)
      "sentence_count": int          # sentences found in the whole document
    }
    """
    cleaned = clean_text(strip_gutenberg(text or ""))
    if not WORD_RE.search(cleaned):
        return {"status": "no_text", "text": None, "sentences": [],
                "key_terms": [], "sentence_count": 0}

    sentences = split_sentences(cleaned)
    tokens = [content_words(s) for s in sentences]

    frequency = Counter(w for words in tokens for w in words)
    key_terms = [{"term": t, "count": c} for t, c in frequency.most_common(8)]

    # Short text: nothing to choose between, return it as written.
    if len(sentences) <= 3:
        return {"status": "ok", "text": " ".join(sentences),
                "sentences": sentences, "key_terms": key_terms,
                "sentence_count": len(sentences)}

    top = frequency.most_common(1)[0][1] if frequency else 1
    weight = {w: c / top for w, c in frequency.items()}

    scored = []
    for index, (sentence, words) in enumerate(zip(sentences, tokens)):
        if not words or not is_candidate(sentence):
            continue
        unique = set(words)
        # average topic weight, so long sentences are not favoured just
        # for being long; a small bonus for covering many different topics.
        score = sum(weight[w] for w in words) / len(words)
        score *= 1 + 0.05 * min(len(unique), 12)
        if re.search(r"[\"“”‘’]", sentence):
            score *= 0.6          # quoted speech rarely states the main idea
        if len(sentence.split()) < 12:
            score *= 0.8          # very short sentences carry less information
        scored.append((score, index, unique))

    if not scored:                                        # e.g. only fragments
        chosen = sentences[:summary_length(len(sentences))]
        return {"status": "ok", "text": " ".join(chosen), "sentences": chosen,
                "key_terms": key_terms, "sentence_count": len(sentences)}

    picks = pick_sentences(scored, summary_length(len(sentences)),
                           len(sentences))
    chosen = [sentences[i] for i in sorted(picks)]
    return {"status": "ok", "text": " ".join(chosen), "sentences": chosen,
            "key_terms": key_terms, "sentence_count": len(sentences)}


def pick_sentences(scored, wanted, total):
    """Greedy pick: best score first, but skip sentences that repeat what we
    already chose, and avoid taking everything from one region."""
    pool = sorted(scored, reverse=True)[:80]              # best candidates only
    zones = Counter()
    picks, picked_words = [], []
    max_per_zone = max(1, -(-wanted // 3))                # ceil(wanted / 3)

    for score, index, unique in pool:
        if len(picks) == wanted:
            break
        zone = index * 3 // max(total, 1)                 # beginning/middle/end
        if zones[zone] >= max_per_zone:
            continue
        if any(len(unique & other) / len(unique | other) > 0.4
               for other in picked_words):
            continue                                      # too similar
        picks.append(index)
        picked_words.append(unique)
        zones[zone] += 1

    # If the spread rule left us short, top up with the next-best sentences.
    for score, index, unique in pool:
        if len(picks) == wanted:
            break
        if index not in picks:
            picks.append(index)
    return picks
