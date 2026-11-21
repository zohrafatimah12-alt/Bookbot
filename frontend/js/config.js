// Settings shared by the frontend scripts.
// These mirror the real limits in the Flask backend (app.py).
window.BOOKBOT_CONFIG = {
  // Where the Flask server runs (python app.py -> port 5000).
  API_BASE: "http://127.0.0.1:5000",
  ANALYZE_PATH: "/analyze",

  // app.py: MAX_CONTENT_LENGTH = 20 * 1024 * 1024
  MAX_BYTES: 20 * 1024 * 1024,

  // app.py only accepts these extensions.
  ALLOWED_EXTENSIONS: [".txt", ".pdf"],

  // Seconds before we give up waiting for the server.
  TIMEOUT_MS: 120000
};
