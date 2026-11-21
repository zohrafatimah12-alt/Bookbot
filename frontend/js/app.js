// BookBot frontend: upload page logic.
// Flow: pick/drop file -> validate -> POST to Flask /analyze -> show report.
(function () {
  "use strict";

  const cfg = window.BOOKBOT_CONFIG;
  const $ = (id) => document.getElementById(id);

  const els = {
    viewUpload: $("view-upload"),
    viewReport: $("view-report"),
    reportRoot: $("report-root"),
    form: $("upload-form"),
    input: $("file-input"),
    tray: $("tray"),
    trayTitle: $("tray-title"),
    specimen: $("specimen"),
    spName: $("sp-name"),
    spType: $("sp-type"),
    spSize: $("sp-size"),
    error: $("file-error"),
    analyze: $("analyze-btn"),
    cancel: $("cancel-btn"),
    clear: $("clear-btn"),
    progress: $("progress"),
    progressBar: $("progress-bar"),
    progressText: $("progress-text"),
    maxLabel: $("max-size-label")
  };

  let selectedFile = null;   // lives only in memory; cleared on reset
  let activeRequest = null;  // the running XMLHttpRequest, if any

  els.maxLabel.textContent = formatBytes(cfg.MAX_BYTES, true);

  /* ---------------- helpers ---------------- */
  function formatBytes(bytes, whole) {
    if (bytes < 1024) return bytes + " bytes";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(whole ? 0 : 2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(whole ? 0 : 2) + " MB";
  }

  function extensionOf(name) {
    const dot = name.lastIndexOf(".");
    return dot === -1 ? "" : name.slice(dot).toLowerCase();
  }

  // Returns an error message, or "" if the file is acceptable.
  function validate(file) {
    if (!cfg.ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      return "“" + file.name + "” is not supported. BookBot accepts only .txt and .pdf files.";
    }
    if (file.size === 0) return "This file is empty (0 bytes). Choose a file that contains text.";
    if (file.size > cfg.MAX_BYTES) {
      return "This file is " + formatBytes(file.size) + ". The maximum allowed size is " + formatBytes(cfg.MAX_BYTES, true) + ".";
    }
    return "";
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }
  function clearError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }

  /* ---------------- selecting a file ---------------- */
  function setFile(file) {
    clearError();
    const problem = validate(file);
    if (problem) {
      resetSelection();
      showError(problem);
      return;
    }
    selectedFile = file;
    els.spName.textContent = file.name;
    els.spType.textContent = extensionOf(file.name).slice(1).toUpperCase();
    els.spSize.textContent = formatBytes(file.size);
    els.specimen.hidden = false;
    els.tray.classList.add("has-file");
    els.trayTitle.textContent = "Specimen loaded — drop another to replace";
    els.analyze.disabled = false;
    els.clear.hidden = false;
  }

  function resetSelection() {
    selectedFile = null;
    els.input.value = "";
    els.specimen.hidden = true;
    els.tray.classList.remove("has-file");
    els.trayTitle.textContent = "Drop a document in the tray";
    els.analyze.disabled = true;
    els.clear.hidden = true;
  }

  els.input.addEventListener("change", () => {
    if (els.input.files.length) setFile(els.input.files[0]);
  });
  els.clear.addEventListener("click", () => { clearError(); resetSelection(); els.tray.focus(); });

  // Keyboard: Enter / Space on the tray opens the file picker.
  els.tray.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.input.click(); }
  });

  /* ---------------- drag and drop ---------------- */
  ["dragenter", "dragover"].forEach((type) =>
    els.tray.addEventListener(type, (e) => { e.preventDefault(); els.tray.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((type) =>
    els.tray.addEventListener(type, (e) => { e.preventDefault(); els.tray.classList.remove("is-over"); }));
  els.tray.addEventListener("drop", (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    if (files.length > 1) { resetSelection(); showError("Please drop one document at a time."); return; }
    setFile(files[0]);
  });
  // Stop the browser from opening a file that is dropped outside the tray.
  ["dragover", "drop"].forEach((type) => window.addEventListener(type, (e) => e.preventDefault()));

  /* ---------------- upload to Flask ---------------- */
  function setBusy(busy) {
    els.tray.classList.toggle("is-busy", busy);
    els.analyze.disabled = busy || !selectedFile;
    els.analyze.textContent = busy ? "Inspecting…" : "Analyze document";
    els.cancel.hidden = !busy;
    els.clear.hidden = busy || !selectedFile;
    els.progress.hidden = !busy;
    els.progress.classList.remove("is-indeterminate");
    els.progressBar.style.width = "0%";
    if (busy) els.progressText.textContent = "Sending document…";
  }

  function friendlyServerError(xhr) {
    let message = "";
    try { message = JSON.parse(xhr.responseText).error || ""; } catch (_) { /* not JSON */ }
    if (message) return message;
    if (xhr.status === 413) return "The file is larger than the server allows (" + formatBytes(cfg.MAX_BYTES, true) + ").";
    return "The server returned an unexpected response (HTTP " + xhr.status + ").";
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedFile || activeRequest) return;
    clearError();

    // Multipart form upload: the backend reads request.files["file"].
    const body = new FormData();
    body.append("file", selectedFile);

    const xhr = new XMLHttpRequest();
    activeRequest = xhr;
    xhr.open("POST", cfg.API_BASE + cfg.ANALYZE_PATH);
    xhr.timeout = cfg.TIMEOUT_MS;

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      els.progressBar.style.width = pct + "%";
      els.progressText.textContent = "Sending document… " + pct + "%";
    };
    xhr.upload.onload = () => {
      els.progress.classList.add("is-indeterminate");
      els.progressText.textContent = "Reading text, counting letters, writing summary…";
    };

    xhr.onload = () => {
      activeRequest = null;
      setBusy(false);
      let data = null;
      if (xhr.status === 200) {
        try { data = JSON.parse(xhr.responseText); } catch (_) { /* handled below */ }
        if (data && typeof data === "object") { showReport(data); return; }
        showError("The server replied, but the analysis could not be understood.");
        return;
      }
      showError(friendlyServerError(xhr));
    };
    xhr.onerror = () => {
      activeRequest = null; setBusy(false);
      showError("Cannot reach the BookBot server at " + cfg.API_BASE + ". Make sure Flask is running (python app.py) and try again.");
    };
    xhr.ontimeout = () => {
      activeRequest = null; setBusy(false);
      showError("The server took too long to respond. Try a smaller document.");
    };
    xhr.onabort = () => { activeRequest = null; setBusy(false); };

    setBusy(true);
    xhr.send(body);
  });

  els.cancel.addEventListener("click", () => { if (activeRequest) activeRequest.abort(); });

  /* ---------------- switching views ---------------- */
  function showReport(data) {
    window.BookBotReport.render(els.reportRoot, data, { onReset: newInvestigation });
    els.viewUpload.hidden = true;
    els.viewReport.hidden = false;
    document.title = "Report: " + data.filename + " — BookBot";
    window.scrollTo(0, 0);
    const heading = $("report-title");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }

  function newInvestigation() {
    els.reportRoot.replaceChildren();   // drop the previous report from memory
    resetSelection();
    clearError();
    els.viewReport.hidden = true;
    els.viewUpload.hidden = false;
    document.title = "BookBot — Document Investigation Lab";
    window.scrollTo(0, 0);
    els.tray.focus();
  }
})();
