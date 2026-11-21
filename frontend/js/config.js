// Settings shared by the frontend scripts.
// These mirror the real limits in the Flask backend (app.py).
// After you deploy the backend on Render, paste its URL here
// (for example "https://bookbot-api.onrender.com", no trailing slash).
const PRODUCTION_API_BASE = "";

const IS_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);

window.BOOKBOT_CONFIG = {
  // Local: Flask on port 5000. Online: the Render backend above.
  API_BASE: IS_LOCAL ? "http://127.0.0.1:5000" : PRODUCTION_API_BASE,
  ANALYZE_PATH: "/analyze",

  // app.py: MAX_CONTENT_LENGTH = 20 * 1024 * 1024
  MAX_BYTES: 20 * 1024 * 1024,

  // app.py only accepts these extensions.
  ALLOWED_EXTENSIONS: [".txt", ".pdf"],

  // Seconds before we give up waiting for the server.
  TIMEOUT_MS: 120000
};
