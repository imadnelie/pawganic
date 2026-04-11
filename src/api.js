const TOKEN_KEY = "pawganic_token";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

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
  const res = await fetch(`${API_BASE}${normalizedPath}`, { ...options, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    let msg = data?.error;
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
    msg =
      msg ||
      res.statusText ||
      (res.status ? `Request failed (HTTP ${res.status})` : "Request failed");
    throw new Error(msg);
  }
  return data;
}
