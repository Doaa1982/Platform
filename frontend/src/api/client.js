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

/** Like request(), but for multipart/form-data (file uploads) — no JSON body, no Content-Type override. */
async function requestForm(path, { method = "POST", form, token } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
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

/* ── Learning products ──────────────────────────────────────────────────── */

/** GET /api/workspaces/{slug}/products */
export function getProducts(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products`, { token });
}

/** POST /api/workspaces/{slug}/products */
export function createProduct(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products`, { method: "POST", body, token });
}

/** PUT /api/workspaces/{slug}/products/{id} */
export function updateProduct(token, slug, id, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${id}`, { method: "PUT", body, token });
}

/** POST .../products/{id}/{transition} — submit | return | publish | unpublish | archive */
export function productTransition(token, slug, id, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${id}/${transition}`, { method: "POST", token });
}

/* ── Content Studio (curriculum, units, lessons) ───────────────────────────
   A Curriculum is created lazily by the API the first time a tutor adds a
   unit or a lesson — there is no separate "create curriculum" call.
   ------------------------------------------------------------------------ */

/** GET /api/workspaces/{slug}/products/{productId}/curriculum */
export function getCurriculum(token, slug, productId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum`, { token });
}

/** POST .../curriculum/units */
export function addUnit(token, slug, productId, title) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units`, {
    method: "POST", body: { title }, token,
  });
}

/** PUT .../curriculum/units/{unitId} */
export function renameUnit(token, slug, productId, unitId, title) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/${unitId}`, {
    method: "PUT", body: { title }, token,
  });
}

/** DELETE .../curriculum/units/{unitId} */
export function removeUnit(token, slug, productId, unitId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/${unitId}`, {
    method: "DELETE", token,
  });
}

/** POST .../curriculum/lessons — creates a lesson, optionally placed straight into a unit */
export function createLesson(token, slug, productId, title, unitId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/lessons`, {
    method: "POST", body: { title, unitId: unitId ?? null }, token,
  });
}

/** POST .../curriculum/units/{unitId}/lessons/{lessonId} — place an existing (unplaced) lesson */
export function placeLesson(token, slug, productId, unitId, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/${unitId}/lessons/${lessonId}`, {
    method: "POST", token,
  });
}

/** DELETE .../curriculum/units/{unitId}/lessons/{lessonId} — unplace, does not delete the lesson */
export function unplaceLesson(token, slug, productId, unitId, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/${unitId}/lessons/${lessonId}`, {
    method: "DELETE", token,
  });
}

/** POST .../curriculum/{transition} — publish | unpublish */
export function curriculumTransition(token, slug, productId, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/${transition}`, {
    method: "POST", token,
  });
}

/* ── Lessons (the content behind one lesson's identity) ────────────────── */

/** GET /api/workspaces/{slug}/lessons/{lessonId} → identity + current/draft revisions + history */
export function getLesson(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}`, { token });
}

/** PUT .../lessons/{lessonId}/draft — saves the open draft revision */
export function saveLessonDraft(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft`, {
    method: "PUT", body, token,
  });
}

/** POST .../lessons/{lessonId}/revisions — opens a new draft on top of the published content */
export function startLessonRevision(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/revisions`, {
    method: "POST", token,
  });
}

/**
 * PUT .../lessons/{lessonId}/current/quick-edit — Title/Body/EstimatedMinutes
 * only, applied straight to the currently published revision (Lesson Editing
 * & Publication UX, Scenario 3). No new revision, no republish.
 */
export function quickEditPublishedLesson(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/current/quick-edit`, {
    method: "PUT", body, token,
  });
}

/** POST .../lessons/{lessonId}/{transition} — publish | unpublish | archive */
export function lessonTransition(token, slug, lessonId, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/${transition}`, {
    method: "POST", token,
  });
}

/** POST .../lessons/{lessonId}/duplicate — clones this lesson's content into a brand-new, separate Lesson */
export function duplicateLesson(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/duplicate`, {
    method: "POST", token,
  });
}

/* ── Learning assets (video upload) ──────────────────────────────────────
   A Learning Asset is a reusable resource a Lesson Revision references by
   id only (Learning Asset Aggregate Design) — this is where the file itself
   goes.
   ------------------------------------------------------------------------ */

/** POST /api/workspaces/{slug}/learning-assets — multipart upload, returns the asset */
export function uploadLearningAsset(token, slug, file, title, onProgress) {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);

  // Plain fetch (via requestForm) has no upload-progress event, so an actual
  // learner-facing progress bar needs XHR. Kept simple here since this only
  // ever runs from the tutor's own authoring flow.
  if (!onProgress) {
    return requestForm(`/workspaces/${encodeURIComponent(slug)}/learning-assets`, { form, token });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/workspaces/${encodeURIComponent(slug)}/learning-assets`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      const payload = xhr.responseText ? safeJson(xhr.responseText) : null;
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
      else reject(new ApiError(xhr.status, payload?.message ?? `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new ApiError(0, "Could not reach the server. Is the API running?"));
    xhr.send(form);
  });
}

/** GET /api/workspaces/{slug}/learning-assets/{assetId}/download — the URL a <video> element points at */
export function learningAssetDownloadUrl(token, slug, assetId) {
  return `/api/workspaces/${encodeURIComponent(slug)}/learning-assets/${assetId}/download?access_token=${encodeURIComponent(token)}`;
}

/** DELETE .../learning-assets/{assetId} — archives it */
export function archiveLearningAsset(token, slug, assetId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learning-assets/${assetId}`, { method: "DELETE", token });
}

/* ── Lesson video (attaching an uploaded asset to a lesson's draft) ─────── */

/** POST .../lessons/{lessonId}/draft/video */
export function attachLessonVideo(token, slug, lessonId, learningAssetId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/video`, {
    method: "POST", body: { learningAssetId }, token,
  });
}

/** DELETE .../lessons/{lessonId}/draft/video */
export function removeLessonVideo(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/video`, {
    method: "DELETE", token,
  });
}

/** PUT .../lessons/{lessonId}/draft/video-url — the "URL" alternative to uploading */
export function setLessonVideoUrl(token, slug, lessonId, url) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/video-url`, {
    method: "PUT", body: { url }, token,
  });
}

/* ── Reference data ───────────────────────────────────────────────────── */

/** GET .../reference/question-types — the QuestionType enum's values + display labels */
export function getQuestionTypes(token) {
  return request(`/reference/question-types`, { token });
}

/* ── Interactive assessment (the quiz attached to a lesson's video) ─────── */

/** GET .../lessons/{lessonId}/assessment */
export function getAssessment(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment`, { token });
}

/** PUT .../lessons/{lessonId}/assessment — title + passing threshold; creates lazily */
export function saveAssessment(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment`, {
    method: "PUT", body, token,
  });
}

/** POST .../assessment/questions */
export function addQuestion(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/questions`, {
    method: "POST", body, token,
  });
}

/** PUT .../assessment/questions/{questionId} */
export function updateQuestion(token, slug, lessonId, questionId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/questions/${questionId}`, {
    method: "PUT", body, token,
  });
}

/** DELETE .../assessment/questions/{questionId} */
export function removeQuestion(token, slug, lessonId, questionId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/questions/${questionId}`, {
    method: "DELETE", token,
  });
}

/** POST .../assessment/{transition} — publish | unpublish */
export function assessmentTransition(token, slug, lessonId, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/${transition}`, {
    method: "POST", token,
  });
}

/** POST .../assessment/ai-suggest — simulated AI: proposes timestamped checkpoints, nothing persisted */
export function suggestQuestions(token, slug, lessonId, videoDurationSeconds) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/ai-suggest`, {
    method: "POST", body: { videoDurationSeconds }, token,
  });
}

/** POST .../assessment/preview — simulated AI grading against the authored answer key; nothing persisted */
export function previewAssessment(token, slug, lessonId, answers) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/assessment/preview`, {
    method: "POST", body: { answers }, token,
  });
}

/* ── Learner delivery (watching a lesson, answering its questions for real) ── */

/** GET .../learn/products — Published products this Learner can open */
export function getLearnerProducts(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/products`, { token });
}

/** GET .../learn/stats — aggregate counts across all this Learner's enrollments */
export function getLearnerStats(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/stats`, { token });
}

/** GET .../learn/products/{productId}/curriculum — auto-enrols on first open */
export function getLearnerCurriculum(token, slug, productId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/products/${productId}/curriculum`, { token });
}

/** GET .../learn/lessons/{lessonId} — the Published revision + answer-key-stripped questions + progress */
export function getLearnerLesson(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}`, { token });
}

/** POST .../learn/lessons/{lessonId}/video-watched */
export function markVideoWatched(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/video-watched`, {
    method: "POST", token,
  });
}

/** POST .../learn/lessons/{lessonId}/submit — grades and persists a real Submission */
export function submitLearnerAssessment(token, slug, lessonId, answers) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/submit`, {
    method: "POST", body: { answers }, token,
  });
}

/* ── Notifications (a member's own in-app inbox) ─────────────────────────
   Lesson Editing & Publication UX, Scenario 4 — the one kind that exists so
   far tells a learner their lesson's questions were improved in place.
   ------------------------------------------------------------------------ */

/** GET /api/workspaces/{slug}/notifications */
export function getMyNotifications(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/notifications`, { token });
}

/** POST .../notifications/{id}/read */
export function markNotificationRead(token, slug, notificationId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/notifications/${notificationId}/read`, {
    method: "POST", token,
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

/* ── Tutor signup ──────────────────────────────────────────────────────────
   Entirely anonymous: an applicant has no Identity at this stage and gets one
   only later, when they accept the invitation to their provisioned workspace.
   They check back via their Signup Status Link, not by logging in (BA-008).
   ------------------------------------------------------------------------ */

/** POST /api/signup-requests — apply to become a tutor */
export function submitSignup(body) {
  return request("/signup-requests", { method: "POST", body });
}

/** GET /api/signup-requests/status/{token} — the Signup Status Link */
export function getSignupStatus(token) {
  return request(`/signup-requests/status/${encodeURIComponent(token)}`);
}

/** POST /api/signup-requests/status/{token}/payment — record a payment outcome */
export function recordSignupPayment(token, succeeded) {
  return request(`/signup-requests/status/${encodeURIComponent(token)}/payment?succeeded=${succeeded}`, {
    method: "POST",
  });
}

/** GET /api/admin/signup-requests — the reviewer's application queue */
export function getSignupRequests(token) {
  return request("/admin/signup-requests", { token });
}

/** POST /api/admin/signup-requests/{id}/approve */
export function approveSignup(token, id) {
  return request(`/admin/signup-requests/${id}/approve`, { method: "POST", token });
}

/** POST /api/admin/signup-requests/{id}/reject */
export function rejectSignup(token, id, body) {
  return request(`/admin/signup-requests/${id}/reject`, { method: "POST", body, token });
}

/** POST /api/admin/signup-requests/{id}/provision — §7.2 for a paid applicant */
export function provisionForSignup(token, id, body) {
  return request(`/admin/signup-requests/${id}/provision`, { method: "POST", body, token });
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
