/* =========================================================================
   API CLIENT — the only place that talks to Platform.Api.

   Requests go to a relative /api path so the Vite dev server can proxy them
   to the backend (see vite.config.js). That keeps the browser same-origin,
   so no CORS preflight and no hard-coded backend port in client code.
   ========================================================================= */

const TOKEN_KEY = "platform.session";

/** Thrown for any non-2xx response, carrying the status so callers can branch. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ── Session storage ──────────────────────────────────────────────────────
   The JWT carries identity-level claims only — no roles. Roles are
   Workspace-scoped and are fetched per Workspace from the API, never
   inferred from the token or cached as though they were global.
   ------------------------------------------------------------------------ */

export function loadSession() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);
    // A token past its expiry is the same as no session at all
    if (!session?.token || new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return session;
  } catch {
    // Corrupt or unreadable storage should log the user out, not crash the app
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ── Requests ─────────────────────────────────────────────────────────────── */

async function request(path, { method = "GET", body, token } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on network failure — distinguish it from an API error
    throw new ApiError(0, "Could not reach the server. Is the API running?");
  }

  if (response.status === 204) return null;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new ApiError(response.status, payload?.message ?? `Request failed (${response.status}).`);
  }

  return payload;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ── Endpoints ────────────────────────────────────────────────────────────── */

/** POST /api/auth/login → { token, expiresAt, fullName } */
export function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

/** GET /api/me → identity + every Workspace it belongs to, with roles in each */
export function getMe(token) {
  return request("/me", { token });
}

/** GET /api/me/workspaces/{slug} → roles held in one Workspace */
export function getWorkspaceAccess(token, slug) {
  return request(`/me/workspaces/${encodeURIComponent(slug)}`, { token });
}
