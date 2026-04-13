const TOKEN_KEY = "pawganic_token";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

function isNetworkFetchError(err) {
  if (!err) return false;
  const name = String(err.name || "");
  const msg = String(err.message || err).toLowerCase();
  return (
    name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror")
  );
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    if (isNetworkFetchError(err)) {
      const hint =
        API_BASE.startsWith("http") && !API_BASE.includes("localhost") && !API_BASE.includes("127.0.0.1")
          ? ` Tried ${url}. If you are on another device, use your computer’s LAN IP instead of localhost in VITE_API_BASE_URL.`
          : " Start the API (port 3001): from the project folder run `npm run dev` (Vite + API) or `npm run dev:server` with `MONGODB_URI` set in `.env`.";
      throw new Error(`Cannot reach the server.${hint}`);
    }
    throw err;
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    let msg =
      typeof data?.error === "string"
        ? data.error
        : data?.error != null
          ? String(data.error)
          : null;
    if (typeof data?.detail === "string" && data.detail.trim()) {
      msg = msg ? `${msg}\n${data.detail}` : data.detail;
    }
    if (!msg && typeof data?.message === "string") msg = data.message;

    if (!msg && res.status === 404 && typeof data?.raw === "string") {
      if (
        data.raw.includes("Cannot PUT") ||
        data.raw.includes("Cannot DELETE") ||
        data.raw.includes("Cannot GET")
      ) {
        msg =
          "API route not found. Restart the backend (port 3001), e.g. stop and run npm run dev or node server/index.js.";
      }
    }
    if (!msg && res.status === 404 && path.startsWith("/expenses")) {
      msg =
        "Expense request failed (404). Restart the API server so the latest routes load, then try again.";
    }
    if (!msg && res.status >= 500 && typeof data?.raw === "string" && data.raw.includes("<!DOCTYPE")) {
      msg =
        "Server error (non-JSON HTML page). Check the API terminal for [api] logs—often an uncaught exception before JSON middleware runs.";
    }
    if (!msg || msg === "Internal Server Error") {
      const flat = String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500);
      if (flat.startsWith("{")) {
        try {
          const j = JSON.parse(String(text));
          if (j?.error) msg = j.detail ? `${j.error}\n${j.detail}` : String(j.error);
        } catch {
          /* ignore */
        }
      } else if (flat) {
        msg = `HTTP ${res.status}: ${flat}`;
      }
    }
    msg =
      msg ||
      res.statusText ||
      (res.status ? `Request failed (HTTP ${res.status})` : "Request failed");
    throw new Error(msg);
  }
  return data;
}
