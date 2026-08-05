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

/* ── Platform administration ───────────────────────────────────────────────
   Every one of these 403s unless the caller holds an Active PlatformOperator
   grant, checked server-side per request. The UI never decides who is an
   admin — it asks and handles being told no.
   ------------------------------------------------------------------------ */

/** GET /api/admin/workspaces → the provisioning view */
export function getProvisioningView(token) {
  return request("/admin/workspaces", { token });
}

/** POST /api/admin/workspaces → creates the Workspace and invites its Owner */
export function provisionWorkspace(token, body) {
  return request("/admin/workspaces", { method: "POST", body, token });
}

/** POST /api/admin/invitations/{id}/resend → fresh token, same invitation */
export function resendInvitation(token, invitationId) {
  return request(`/admin/invitations/${invitationId}/resend`, { method: "POST", token });
}

/** POST /api/admin/invitations/{id}/cancel */
export function cancelInvitation(token, invitationId) {
  return request(`/admin/invitations/${invitationId}/cancel`, { method: "POST", token });
}

/** POST /api/admin/workspaces/{id}/{action} — suspend | reinstate | archive */
export function workspaceAction(token, workspaceId, action) {
  return request(`/admin/workspaces/${workspaceId}/${action}`, { method: "POST", token });
}

/* ── Workspace members (the tutor's own surface) ───────────────────────────
   Authority here is Workspace-scoped and resolved server-side from the
   caller's Membership, so the UI asks and reflects the answer rather than
   deciding who may manage.
   ------------------------------------------------------------------------ */

/** GET /api/workspaces/{slug}/members → members, invitations, and canManage */
export function getMembers(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members`, { token });
}

/** POST /api/workspaces/{slug}/invitations → invite someone into this Workspace */
export function inviteMember(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/invitations`, { method: "POST", body, token });
}

/** POST /api/workspaces/{slug}/members/{id}/{action} — activate | suspend | reinstate | archive | remove */
export function memberAction(token, slug, membershipId, action) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members/${membershipId}/${action}`, {
    method: "POST", token,
  });
}

/** POST .../members/{id}/roles → grant a Workspace role */
export function assignMemberRole(token, slug, membershipId, role) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members/${membershipId}/roles`, {
    method: "POST", body: { role }, token,
  });
}

/** DELETE .../members/{id}/roles/{role} → revoke a Workspace role */
export function removeMemberRole(token, slug, membershipId, role) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members/${membershipId}/roles/${encodeURIComponent(role)}`, {
    method: "DELETE", token,
  });
}

/* ── Workspace setup (the owner's own lifecycle) ───────────────────────── */

/** GET /api/workspaces/{slug}/setup → identity, status, completeness, next step */
export function getSetup(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup`, { token });
}

/** PUT /api/workspaces/{slug}/setup/identity */
export function updateWorkspaceIdentity(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/identity`, { method: "PUT", body, token });
}

/**
 * POST /api/workspaces/{slug}/setup/{transition}
 * begin-configuration | make-private | publish | activate
 * Each returns the whole setup state, so the caller never re-derives what changed.
 */
export function workspaceTransition(token, slug, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/${transition}`, { method: "POST", token });
}

/* ── Join requests ─────────────────────────────────────────────────────────
   The only inbound path to Membership. Preview and submit are anonymous by
   necessity: a stranger has no account, and requiring one first is circular
   (BA-003). Submit is the rate-limited endpoint.
   ------------------------------------------------------------------------ */

/** GET /api/workspaces/{slug}/join — anonymous; 404 unless discoverable */
export function previewJoin(slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join`);
}

/** POST /api/workspaces/{slug}/join — anonymous; creates an Identity, returns a session */
export function submitJoin(slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join`, { method: "POST", body });
}

/** GET /api/workspaces/{slug}/join-requests — the reviewer's queue */
export function getJoinRequests(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join-requests`, { token });
}

/** POST .../join-requests/{id}/{decision} — approve | decline */
export function decideJoinRequest(token, slug, id, decision) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join-requests/${id}/${decision}`, {
    method: "POST", token,
  });
}

/** GET /api/me/join-requests — the requester's own */
export function getMyJoinRequests(token) {
  return request("/me/join-requests", { token });
}

/** POST /api/me/join-requests/{id}/withdraw */
export function withdrawJoinRequest(token, id) {
  return request(`/me/join-requests/${id}/withdraw`, { method: "POST", token });
}

/* ── Invitations (anonymous — the token is the credential) ─────────────── */

/** GET /api/invitations/{token} → what the invitee sees before accepting */
export function previewInvitation(inviteToken) {
  return request(`/invitations/${encodeURIComponent(inviteToken)}`);
}

/** POST /api/invitations/{token}/accept → membership created, returns a session */
export function acceptInvitation(inviteToken, body) {
  return request(`/invitations/${encodeURIComponent(inviteToken)}/accept`, { method: "POST", body });
}
