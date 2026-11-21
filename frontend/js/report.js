// BookBot frontend: builds the analysis report from the Flask JSON.
// Every number shown here comes from the API response, or is calculated
// from it (percentages, letter totals). Nothing is sample data.
(function () {
  "use strict";

  const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  const fmt = (n) => Number(n).toLocaleString("en-US");

  // Tiny DOM helper. Text always goes through textContent, so document
  // content (filenames, summary sentences) can never inject HTML.
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value === false || value == null) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("data-") || key.startsWith("aria-") || key === "role" || key === "scope" || key === "id")
        node.setAttribute(key, value);
      else if (key === "style") node.setAttribute("style", value);
      else node[key] = value;
    });
    [].concat(children || []).forEach((c) => {
      if (c == null) return;
      node.append(c.nodeType ? c : document.createTextNode(c));
    });
    return node;
  }

  function plate(number, title, index, extraClass) {
    return el("section", {
      class: "plate " + (extraClass || ""),
      style: "--i:" + index,
      "aria-labelledby": "plate-" + number
    }, [
      el("header", { class: "plate__head" }, [
        el("span", { class: "plate__num", "aria-hidden": "true", text: "Plate " + number }),
        el("h2", { class: "plate__title", id: "plate-" + number, text: title })
      ])
    ]);
  }

  function notice(text) {
    return el("p", { class: "notice", text: text });
  }

  /* ---------------- A. overview ---------------- */
  function buildOverview(d) {
    const letterTotal = d.character_frequency.reduce((s, c) => s + c.count, 0);
    const p = plate("I", "Document overview", 1);

    p.append(el("div", { class: "bignums" }, [
      bigNumber(fmt(d.word_count), "words"),
      bigNumber(fmt(d.character_count), "characters in total"),
      bigNumber(fmt(letterTotal), "letters")
    ]));

    const pageValue = d.page_count == null
      ? el("span", { class: "na", text: "Not applicable — plain text has no pages" })
      : fmt(d.page_count);

    const rows = [
      ["Filename", d.filename],
      ["File type", d.file_type],
      ["Size in bytes", fmt(d.file_size_bytes)],
      ["Size in KB", d.file_size_kb.toFixed(2)],
      ["Size in MB", d.file_size_mb.toFixed(2)],
      ["Word count", fmt(d.word_count)],
      ["Character count", fmt(d.character_count) + " (every character, including spaces and punctuation)"],
      ["Letters counted", fmt(letterTotal) + " (a–z and other letters; used by the frequency chart)"],
      ["PDF pages", pageValue]
    ];
    p.append(el("dl", { class: "ledger" }, rows.map(([k, v]) =>
      el("div", { class: "ledger__row" }, [el("dt", { text: k }), el("dd", {}, [v])]))));
    return p;
  }

  function bigNumber(value, label) {
    return el("div", { class: "bignum" }, [
      el("span", { class: "bignum__value", text: value }),
      el("span", { class: "bignum__label", text: label })
    ]);
  }

  /* ---------------- B. summary ---------------- */
  function buildSummary(d) {
    const p = plate("II", "Document summary", 2, "plate--abstract");
    const sentences = d.summary_sentences || [];

    if (!d.summary || d.summary_status === "no_text" || !sentences.length) {
      p.append(notice(d.page_count != null
        ? "No summary available: this PDF contains no extractable text. It may be a scanned image or contain only pictures."
        : "No summary available: this document contains no readable text."));
      return p;
    }

    p.append(el("p", { class: "abstract__meta" },
      "Extractive summary · " + sentences.length + " of " + fmt(d.total_sentences) +
      " sentences · quoted from the document in their original order"));

    const body = el("div", { class: "abstract" });
    sentences.forEach((s, i) => {
      body.append(el("p", { class: "abstract__line" }, [
        el("span", { class: "abstract__no", "aria-hidden": "true", text: String(i + 1).padStart(2, "0") }),
        el("span", { class: "abstract__text", text: s })
      ]));
    });
    p.append(body);

    if ((d.key_terms || []).length) {
      p.append(el("div", { class: "terms" }, [
        el("h3", { class: "terms__title", text: "Index terms — most repeated topic words" }),
        el("ul", { class: "terms__list" }, d.key_terms.map((t) =>
          el("li", {}, [el("span", { class: "term", text: t.term }), el("span", { class: "term__n", text: "×" + fmt(t.count) })])))
      ]));
    }
    return p;
  }

  /* ---------------- C. character analysis ---------------- */
  function buildCharacters(d) {
    const p = plate("III", "Character analysis", 3);
    const freq = d.character_frequency;

    if (!freq.length) {
      p.append(notice("No letters were found in this document, so there is no frequency data to chart."));
      return p;
    }

    const total = freq.reduce((s, c) => s + c.count, 0);
    const max = freq[0].count;
    const top = freq.slice(0, 3);

    p.append(el("p", { class: "lead-in" }, [
      "Most frequent letters: ",
      ...top.flatMap((c, i) => [i ? ", " : "", el("strong", { class: "mono", text: c.character.toUpperCase() }), " (" + fmt(c.count) + ")"]),
      ". Frequencies are case-insensitive; digits, spaces and punctuation are not counted here."
    ]));

    // Bar chart (decorative for screen readers: the table below holds the data)
    const chart = el("div", {
      class: "bars", role: "img",
      "aria-label": "Horizontal bar chart of letter frequency. Most frequent: " +
        top.map((c) => c.character + " " + fmt(c.count)).join(", ") + ". Full data in the table below."
    });
    freq.forEach((c, i) => {
      const share = (c.count / total) * 100;
      const bar = el("div", { class: "bar" + (i < 3 ? " bar--top" : "") }, [
        el("span", { class: "bar__label", text: c.character.toUpperCase() }),
        el("span", { class: "bar__track" }, [el("span", {
          class: "bar__fill", "data-w": ((c.count / max) * 100).toFixed(2), style: "--d:" + Math.min(i, 30) * 25 + "ms"
        })]),
        el("span", { class: "bar__value", text: fmt(c.count) }),
        el("span", { class: "bar__pct", text: share.toFixed(1) + "%" })
      ]);
      chart.append(bar);
    });
    p.append(chart);

    // Frequency table
    const tbody = el("tbody", {}, freq.map((c, i) => el("tr", {}, [
      el("td", { text: String(i + 1) }),
      el("th", { scope: "row", text: c.character.toUpperCase() + " " + c.character }),
      el("td", { text: fmt(c.count) }),
      el("td", { text: ((c.count / total) * 100).toFixed(2) + "%" })
    ])));
    p.append(el("details", { class: "tablebox", open: true }, [
      el("summary", { text: "Frequency table (" + freq.length + " letters)" }),
      el("div", { class: "tablewrap" }, [el("table", { class: "freq" }, [
        el("caption", { class: "visually-hidden", text: "Letter frequency, most to least common" }),
        el("thead", {}, [el("tr", {}, ["Rank", "Letter", "Count", "Share of letters"].map((h) => el("th", { scope: "col", text: h })))]),
        tbody
      ])])
    ]));
    return p;
  }

  /* ---------------- D. alphabet ---------------- */
  function buildAlphabet(d) {
    const p = plate("IV", "Alphabet analysis", 4);
    const unused = new Set(d.unused_letters);
    const counts = new Map(d.character_frequency.map((c) => [c.character, c.count]));
    const usedList = ALPHABET.filter((l) => !unused.has(l));

    p.append(el("div", { class: "alpha-stats" }, [
      stat(String(usedList.length), "English letters used", "found"),
      stat(String(d.unused_letters.length), "unused", "missing"),
      stat("26", "in the alphabet", "")
    ]));

    const strip = el("ol", { class: "strip", "aria-label": "Alphabet usage: " + usedList.length + " of 26 letters used" });
    ALPHABET.forEach((l, i) => {
      const isUnused = unused.has(l);
      strip.append(el("li", {
        class: "cell " + (isUnused ? "cell--missing" : "cell--found"), style: "--d:" + i * 22 + "ms"
      }, [
        el("span", { class: "cell__letter", "aria-hidden": "true", text: l }),
        el("span", { class: "cell__sub", "aria-hidden": "true", text: isUnused ? "none" : fmt(counts.get(l) || 0) }),
        el("span", { class: "visually-hidden", text: l.toUpperCase() + (isUnused ? ": unused" : ": used") })
      ]));
    });
    p.append(strip);
    p.append(el("p", { class: "legend" }, [
      el("span", { class: "key key--found" }), " used   ",
      el("span", { class: "key key--missing" }), " never appears"
    ]));

    const lists = el("div", { class: "letterlists" });
    lists.append(letterList("Used letters", usedList, "found"));
    lists.append(unused.size
      ? letterList("Unused letters (" + unused.size + ")", d.unused_letters, "missing")
      : el("div", {}, [el("h3", { class: "letterlist__title", text: "Unused letters (0)" }),
          el("p", { class: "notice notice--plain", text: "Every letter of the English alphabet appears at least once." })]));
    p.append(lists);
    return p;
  }

  function stat(value, label, tone) {
    return el("div", { class: "astat" + (tone ? " astat--" + tone : "") }, [
      el("span", { class: "astat__value", text: value }), el("span", { class: "astat__label", text: label })]);
  }

  function letterList(title, letters, tone) {
    return el("div", {}, [
      el("h3", { class: "letterlist__title", text: title }),
      el("p", { class: "letterlist letterlist--" + tone, text: letters.join(" ") })
    ]);
  }

  /* ---------------- render ---------------- */
  function render(root, d, handlers) {
    root.replaceChildren();

    const newBtn = () => el("button", { class: "stamp", type: "button", text: "Analyze another document", onclick: handlers.onReset });
    const page = el("div", { class: "page page--report" });

    page.append(el("header", { class: "report-head" }, [
      el("p", { class: "eyebrow", text: "Investigation report · " + d.file_type }),
      el("h1", { class: "report-title", id: "report-title", text: d.filename }),
      el("div", { class: "report-head__actions" }, [newBtn()])
    ]));

    const emptyDoc = d.word_count === 0 && d.character_count === 0;
    if (emptyDoc) page.append(notice("This document contains no text. The statistics below are all zero."));

    page.append(buildOverview(d), buildSummary(d), buildCharacters(d), buildAlphabet(d));
    page.append(el("footer", { class: "report-foot" }, [newBtn()]));
    root.append(page);

    // Animate bars after the first paint so the width transition runs.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll(".bar__fill").forEach((b) => { b.style.width = b.getAttribute("data-w") + "%"; });
    }));
  }

  window.BookBotReport = { render };
})();
