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

/* ── Account recovery (anonymous — a forgotten password needs no session) ───
   Deliberately mirrors the Invitations shape: the token in the URL is the
   credential. forgotPassword() always resolves the same way regardless of
   whether the email has an account — never branch the UI on its content.
   ------------------------------------------------------------------------ */

/** POST /api/auth/forgot-password → { message } — same response either way */
export function forgotPassword(email) {
  return request("/auth/forgot-password", { method: "POST", body: { email } });
}

/** GET /api/auth/reset-password/{token} → { email, expiresAt } */
export function previewPasswordReset(resetToken) {
  return request(`/auth/reset-password/${encodeURIComponent(resetToken)}`);
}

/** POST /api/auth/reset-password/{token} → { token, expiresAt, fullName } — signs the caller in */
export function resetPassword(resetToken, newPassword) {
  return request(`/auth/reset-password/${encodeURIComponent(resetToken)}`, {
    method: "POST", body: { newPassword },
  });
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

/** POST /api/workspaces/{slug}/invitations/bulk → invite many people at once, under one batch */
export function inviteMembersBulk(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/invitations/bulk`, { method: "POST", body, token });
}

/** POST /api/workspaces/{slug}/invitations/{id}/resend → fresh token, same invitation */
export function resendMemberInvitation(token, slug, invitationId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/invitations/${invitationId}/resend`, {
    method: "POST", token,
  });
}

/** POST /api/workspaces/{slug}/invitations/{id}/cancel — legal before acceptance only */
export function cancelMemberInvitation(token, slug, invitationId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/invitations/${invitationId}/cancel`, {
    method: "POST", token,
  });
}

/** POST /api/workspaces/{slug}/members/{id}/{action} — activate | suspend | reinstate | archive | remove */
export function memberAction(token, slug, membershipId, action) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members/${membershipId}/${action}`, {
    method: "POST", token,
  });
}

/** POST .../members/{id}/enroll → enrol an already-active member into a published course */
export function enrollMember(token, slug, membershipId, learningProductId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/members/${membershipId}/enroll`, {
    method: "POST", body: { learningProductId }, token,
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

/** POST /api/workspaces/{slug}/products/ai-suggest-description — drafts a listing description; no product needs to exist yet. */
export function suggestProductDescription(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/ai-suggest-description`, { method: "POST", body, token });
}

/** POST .../products/{id}/cover-image — attach (or, with learningAssetId: null, clear) a cover photo already uploaded via uploadLearningAsset(..., "Image") */
export function attachProductCoverImage(token, slug, productId, learningAssetId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/cover-image`, {
    method: "POST", body: { learningAssetId }, token,
  });
}

/** GET .../products/{id}/roster → who's enrolled in this course, and who's still invited */
export function getProductRoster(token, slug, productId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/roster`, { token });
}

/** POST .../products/{id}/enrollments/{membershipId}/unenroll — removes the Enrollment only; Membership is untouched */
export function unenrollMember(token, slug, productId, membershipId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/enrollments/${membershipId}/unenroll`, {
    method: "POST", token,
  });
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

/** PUT .../curriculum/units/reorder — unitIds is every unit's id, once each, in the new order */
export function reorderUnits(token, slug, productId, unitIds) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/reorder`, {
    method: "PUT", body: { unitIds }, token,
  });
}

/** PUT .../curriculum/units/{unitId}/lessons/reorder — lessonIds is every lesson's id in that unit, once each, in the new order */
export function reorderLessons(token, slug, productId, unitId, lessonIds) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/units/${unitId}/lessons/reorder`, {
    method: "PUT", body: { lessonIds }, token,
  });
}

/** PUT .../curriculum/sequential-unlock — require each lesson to be completed before the next one opens */
export function setSequentialUnlock(token, slug, productId, enabled) {
  return request(`/workspaces/${encodeURIComponent(slug)}/products/${productId}/curriculum/sequential-unlock`, {
    method: "PUT", body: { enabled }, token,
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

/** POST /api/workspaces/{slug}/learning-assets — multipart upload, returns the asset. `category` is "Video" (default) or "Resource". */
export function uploadLearningAsset(token, slug, file, title, onProgress, category) {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  if (category) form.append("category", category);

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

/** POST /api/workspaces/{slug}/learning-assets/submission — a learner attaching their own completed work (e.g. a filled-out worksheet) to an Assignment submission's response. Always Resource category. */
export function uploadSubmissionAsset(token, slug, file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  if (!onProgress) {
    return requestForm(`/workspaces/${encodeURIComponent(slug)}/learning-assets/submission`, { form, token });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/workspaces/${encodeURIComponent(slug)}/learning-assets/submission`);
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

/* ── Lesson resources (supplementary files: slides, worksheets, handouts) ── */

/**
 * POST .../lessons/{lessonId}/resources — attaches an uploaded Learning
 * Asset to whichever revision is open for editing. `visibleToLearners`
 * defaults to true server-side if omitted — pass false for a file attached
 * purely as AI-extraction source material that shouldn't become a
 * student-facing download.
 */
export function addLessonResource(token, slug, lessonId, learningAssetId, visibleToLearners) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/resources`, {
    method: "POST", body: { learningAssetId, visibleToLearners }, token,
  });
}

/** DELETE .../lessons/{lessonId}/resources/{resourceId} */
export function removeLessonResource(token, slug, lessonId, resourceId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/resources/${resourceId}`, {
    method: "DELETE", token,
  });
}

/** PUT .../lessons/{lessonId}/resources/{resourceId}/visibility — flips whether a resource is shown to learners as a download */
export function setLessonResourceVisibility(token, slug, lessonId, resourceId, visibleToLearners) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/resources/${resourceId}/visibility`, {
    method: "PUT", body: { visibleToLearners }, token,
  });
}

/* ── Learning Activities (the work a lesson revision assigns to learners) ──
   Draft-only to add/edit/remove/reorder — see LessonRevision.AddLearningActivity.
   ------------------------------------------------------------------------ */

/** POST .../lessons/{lessonId}/activities */
export function addLearningActivity(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities`, {
    method: "POST", body, token,
  });
}

/** PUT .../lessons/{lessonId}/activities/{activityId} */
export function updateLearningActivity(token, slug, lessonId, activityId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}`, {
    method: "PUT", body, token,
  });
}

/** DELETE .../lessons/{lessonId}/activities/{activityId} */
export function removeLearningActivity(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}`, {
    method: "DELETE", token,
  });
}

/** PUT .../lessons/{lessonId}/activities/reorder — every activity id currently on the revision, once each, in the desired order */
export function reorderLearningActivities(token, slug, lessonId, activityIds) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/reorder`, {
    method: "PUT", body: { activityIds }, token,
  });
}

/* ── Assignment (delivering one Learning Activity — scheduling, attempts, evaluation policy) ──
   Tutor-facing. Recipients are never chosen here — every active Enrollment
   in the Learning Product gets it, resolved server-side.
   ------------------------------------------------------------------------ */

/** GET .../lessons/{lessonId}/activities/{activityId}/assignment */
export function getAssignment(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment`, { token });
}

/** POST .../assignment — creates a Draft assignment for this activity (INV-002: at most one) */
export function createAssignment(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment`, {
    method: "POST", token,
  });
}

/** PUT .../assignment — availability/due date/window/attempts/evaluation method/notifications */
export function configureAssignment(token, slug, lessonId, activityId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment`, {
    method: "PUT", body, token,
  });
}

/** POST .../assignment/{transition} — publish | close | archive */
export function assignmentTransition(token, slug, lessonId, activityId, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment/${transition}`, {
    method: "POST", token,
  });
}

/** POST .../assignment/due-date — a due date may only move later (Assignment BA-007) */
export function extendAssignmentDueDate(token, slug, lessonId, activityId, newDueAt) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment/due-date`, {
    method: "POST", body: { newDueAt }, token,
  });
}

/** POST .../assignment/attempt-limit — may be raised freely; refused below the most attempts any one learner has already used */
export function changeAssignmentAttemptLimit(token, slug, lessonId, activityId, newMaxAttempts) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment/attempt-limit`, {
    method: "POST", body: { newMaxAttempts }, token,
  });
}

/** POST .../assignment/attempts/{membershipId}/reset — that learner's prior attempts are kept as history, just excluded from the limit */
export function resetAssignmentAttempts(token, slug, lessonId, activityId, membershipId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment/attempts/${membershipId}/reset`, {
    method: "POST", token,
  });
}

/** POST .../assignment/visibility */
export function changeAssignmentVisibility(token, slug, lessonId, activityId, visible) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/activities/${activityId}/assignment/visibility`, {
    method: "POST", body: { visible }, token,
  });
}

/**
 * POST .../lessons/{lessonId}/transcript/generate — starts AI transcription
 * of the open revision's uploaded video. Returns immediately with
 * TranscriptStatus "Processing"; poll getLesson to see when it's Ready.
 */
export function generateLessonTranscript(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/transcript/generate`, {
    method: "POST", token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-body — drafts (if empty) or
 * improves (if not) lesson body content from whatever's currently typed in
 * the form. Nothing is saved — the caller still has to Save themselves.
 */
export function suggestLessonBody(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-body`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-what-youll-learn — drafts the
 * short learner-facing "what you'll learn" preview from the form's current
 * title/body, preferring a Ready transcript server-side if one exists.
 * Nothing is saved — the caller still has to Save themselves.
 */
export function suggestWhatYoullLearn(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-what-youll-learn`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-title — proposes a sharper
 * title grounded in the form's current body (or a Ready transcript, read
 * server-side). Nothing is saved — the caller still has to Save themselves.
 */
export function suggestLessonTitle(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-title`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-learning-objectives — drafts
 * Bloom's-taxonomy-style objectives, preferring a Ready transcript (read
 * server-side) over the form's current title/body. Nothing is saved — the
 * caller still has to Save themselves.
 */
export function suggestLearningObjectives(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-learning-objectives`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-glossary — extracts key terms
 * and one-line definitions, preferring a Ready transcript (read
 * server-side) over the form's current title/body. Nothing is saved — the
 * caller still has to Save themselves.
 */
export function suggestGlossary(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-glossary`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/ai-suggest-homework — suggests
 * homework/practical exercises, preferring a Ready transcript (read
 * server-side) over the form's current title/body. Nothing is saved — the
 * caller still has to Save themselves.
 */
export function suggestHomework(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/ai-suggest-homework`, {
    method: "POST", body, token,
  });
}

/**
 * POST .../lessons/{lessonId}/resources/{resourceId}/extract — reads a
 * PDF/image resource with AI and drafts title/body/whatYoullLearn/
 * learningObjectives/glossary from its content. Nothing is saved — the
 * caller still has to Save themselves, same as every ai-suggest-* call.
 * A response with every field null means the model found nothing
 * extractable in the file — not a request failure.
 */
export function extractResourceContent(token, slug, lessonId, resourceId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/resources/${resourceId}/extract`, {
    method: "POST", token,
  });
}

/**
 * POST .../lessons/{lessonId}/draft/structure-pasted-content — the manual
 * fallback for extractResourceContent: the tutor pastes text themselves
 * (e.g. copied out of a PDF reader) instead of letting AI read the file.
 * Same five-field response shape; a response with every field null means
 * the model found nothing usable in the pasted text.
 */
export function structurePastedContent(token, slug, lessonId, text) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/structure-pasted-content`, {
    method: "POST", body: { text }, token,
  });
}

/** PUT .../lessons/{lessonId}/draft/require-quiz-to-complete — whether a video-less lesson only completes once the learner passes its Standalone Quiz */
export function setLessonRequireQuizToComplete(token, slug, lessonId, requireQuizToComplete) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/draft/require-quiz-to-complete`, {
    method: "PUT", body: { requireQuizToComplete }, token,
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

/* ── Standalone assessment (the lesson's separate, non-video-synced quiz) ──
   Same shape as the Interactive block above, pinned to its own route — the
   two never share an Assessment row (see AssessmentKind). No ai-suggest: a
   Standalone quiz isn't timestamped against a video, so checkpoints don't apply.
   ------------------------------------------------------------------------ */

/** GET .../lessons/{lessonId}/standalone-assessment */
export function getStandaloneAssessment(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment`, { token });
}

/** PUT .../lessons/{lessonId}/standalone-assessment — title + passing threshold; creates lazily */
export function saveStandaloneAssessment(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment`, {
    method: "PUT", body, token,
  });
}

/** POST .../standalone-assessment/questions */
export function addStandaloneQuestion(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/questions`, {
    method: "POST", body, token,
  });
}

/** PUT .../standalone-assessment/questions/{questionId} */
export function updateStandaloneQuestion(token, slug, lessonId, questionId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/questions/${questionId}`, {
    method: "PUT", body, token,
  });
}

/** DELETE .../standalone-assessment/questions/{questionId} */
export function removeStandaloneQuestion(token, slug, lessonId, questionId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/questions/${questionId}`, {
    method: "DELETE", token,
  });
}

/** POST .../standalone-assessment/ai-suggest — AI-drafted questions grounded in the lesson's text, nothing persisted */
export function suggestStandaloneQuestions(token, slug, lessonId, questionCount) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/ai-suggest`, {
    method: "POST", body: { questionCount }, token,
  });
}

/** POST .../standalone-assessment/{transition} — publish | unpublish */
export function standaloneAssessmentTransition(token, slug, lessonId, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/${transition}`, {
    method: "POST", token,
  });
}

/** POST .../standalone-assessment/preview — simulated AI grading against the authored answer key; nothing persisted */
export function previewStandaloneAssessment(token, slug, lessonId, answers) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/preview`, {
    method: "POST", body: { answers }, token,
  });
}

/** PUT .../standalone-assessment/adaptive — opts this quiz into (or out of, or reconfigures) adaptive delivery */
export function configureAdaptiveAssessment(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/lessons/${lessonId}/standalone-assessment/adaptive`, {
    method: "PUT", body, token,
  });
}

/* ── Assessments overview (tutor gradebook) ──────────────────────────────
   Workspace-wide and read-only — distinct from the per-lesson editor above.
   ------------------------------------------------------------------------ */

/** GET .../assessments — every assessment across every product, with submission counts/avg score/pass rate */
export function getAssessmentsOverview(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assessments`, { token });
}

/** GET .../assessments/{assessmentId} — per-question stats + submitter list */
export function getAssessmentDetail(token, slug, assessmentId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assessments/${assessmentId}`, { token });
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

/* ── Assignments overview (tutor dashboard + grading queue) ──────────────
   Workspace-wide — distinct from the per-activity editor above.
   ------------------------------------------------------------------------ */

/** GET .../assignments — every assignment across every product, with recipient/submitted counts */
export function getAssignmentsOverview(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assignments`, { token });
}

/** GET .../assignments/lessons/{lessonId}/activities/{activityId}/submissions — every recipient × their submission (or "NotStarted") */
export function getAssignmentSubmissions(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assignments/lessons/${lessonId}/activities/${activityId}/submissions`, { token });
}

/** POST .../submissions/{submissionId}/begin-review — marks a submitted response as being looked at; purely informational */
export function beginAssignmentReview(token, slug, lessonId, activityId, submissionId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assignments/lessons/${lessonId}/activities/${activityId}/submissions/${submissionId}/begin-review`, {
    method: "POST", token,
  });
}

/** POST .../submissions/{submissionId}/evaluate — Pass/Fail + feedback; once evaluated it cannot be evaluated again */
export function evaluateAssignmentSubmission(token, slug, lessonId, activityId, submissionId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/assignments/lessons/${lessonId}/activities/${activityId}/submissions/${submissionId}/evaluate`, {
    method: "POST", body, token,
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

/** POST .../learn/products/{productId}/join-request — asks for access to an ApprovalRequired course */
export function submitCourseJoinRequest(token, slug, productId, message) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/products/${productId}/join-request`, {
    method: "POST", body: { message: message || null }, token,
  });
}

/** GET .../learn/assessments — every Published assessment across this learner's enrolled products, with their own attempt if any */
export function getMyAssessments(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/assessments`, { token });
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

/** POST .../learn/lessons/{lessonId}/standalone-assessment/submit — grades and persists a real Submission against the lesson's Standalone quiz */
export function submitStandaloneAssessment(token, slug, lessonId, answers) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/standalone-assessment/submit`, {
    method: "POST", body: { answers }, token,
  });
}

/** POST .../learn/lessons/{lessonId}/standalone-assessment/adaptive/start — begins a new adaptive attempt, returns Question #1 */
export function startAdaptiveAssessment(token, slug, lessonId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/standalone-assessment/adaptive/start`, {
    method: "POST", token,
  });
}

/* ── Learner assignments (the work assigned to this learner, across every enrolled product) ── */

/** GET .../learn/assignments — every Assignment targeting this learner, with their own submission status */
export function getMyAssignments(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/assignments`, { token });
}

/** GET .../learn/lessons/{lessonId}/activities/{activityId}/assignment — the policy, the activity content, and every attempt of this learner's own so far */
export function getMyAssignment(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/activities/${activityId}/assignment`, { token });
}

/** POST .../assignment/start — starts a new attempt, or resumes an already-in-progress one */
export function startAssignmentSubmission(token, slug, lessonId, activityId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/activities/${activityId}/assignment/start`, {
    method: "POST", token,
  });
}

/** POST .../assignment/submissions/{submissionId}/respond — records Text and/or an attached file, moves the attempt to Submitted */
export function recordAssignmentResponse(token, slug, lessonId, activityId, submissionId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/activities/${activityId}/assignment/submissions/${submissionId}/respond`, {
    method: "POST", body, token,
  });
}

/** POST .../learn/lessons/{lessonId}/standalone-assessment/adaptive/answer — records one answer, returns the next question or the finished result */
export function recordAdaptiveAnswer(token, slug, lessonId, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/standalone-assessment/adaptive/answer`, {
    method: "POST", body, token,
  });
}

/** POST .../learn/lessons/{lessonId}/ask — in-lesson AI Assistant, grounded in this lesson's material only */
export function askLessonAssistant(token, slug, lessonId, question) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/ask`, {
    method: "POST", body: { question }, token,
  });
}

/** POST .../learn/lessons/{lessonId}/practice-quiz — Studio "Quiz": on-demand, ungraded self-check */
export function generateLessonQuiz(token, slug, lessonId, { questionCount, difficulty, topic }) {
  return request(`/workspaces/${encodeURIComponent(slug)}/learn/lessons/${lessonId}/practice-quiz`, {
    method: "POST", body: { questionCount, difficulty, topic }, token,
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

/** PUT /api/workspaces/{slug}/setup/join-requests */
export function setAcceptsJoinRequests(token, slug, accepts) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/join-requests`, {
    method: "PUT", body: { accepts }, token,
  });
}

/**
 * POST /api/workspaces/{slug}/setup/{transition}
 * begin-configuration | make-private | publish | activate
 * Each returns the whole setup state, so the caller never re-derives what changed.
 */
export function workspaceTransition(token, slug, transition) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/${transition}`, { method: "POST", token });
}

/** PUT /api/workspaces/{slug}/setup/branding — logo, welcome message, course categories */
export function updateWorkspaceBranding(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/branding`, { method: "PUT", body, token });
}

/** POST /api/workspaces/{slug}/setup/ai-suggest-description */
export function suggestWorkspaceDescription(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/ai-suggest-description`, { method: "POST", body, token });
}

/** POST /api/workspaces/{slug}/setup/ai-suggest-welcome */
export function suggestWorkspaceWelcome(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/setup/ai-suggest-welcome`, { method: "POST", body, token });
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

/** POST /api/admin/signup-requests/{id}/provision — §7.2 for an approved applicant */
export function provisionForSignup(token, id, body) {
  return request(`/admin/signup-requests/${id}/provision`, { method: "POST", body, token });
}

/* ── Join requests ─────────────────────────────────────────────────────────
   The only inbound path to Membership. Preview and submit are anonymous, and
   submit creates no account — it files a name/email/message for a reviewer to
   decide on. Approval turns it into a real Invitation; an account only ever
   comes from accepting that. Submit is the rate-limited endpoint.
   ------------------------------------------------------------------------ */

/** GET /api/workspaces/{slug}/join — anonymous; 404 unless discoverable */
export function previewJoin(slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join`);
}

/** POST /api/workspaces/{slug}/join — anonymous; files a request, no account created */
export function submitJoin(slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join`, { method: "POST", body });
}

/** GET /api/workspaces/{slug}/join-requests — the reviewer's queue */
export function getJoinRequests(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join-requests`, { token });
}

/** POST .../join-requests/{id}/{decision} — approve | decline. Approve issues an Invitation. */
export function decideJoinRequest(token, slug, id, decision) {
  return request(`/workspaces/${encodeURIComponent(slug)}/join-requests/${id}/${decision}`, {
    method: "POST", token,
  });
}

/** GET .../course-join-requests — the reviewer's queue for course-level ("Ask to join first") requests */
export function getCourseJoinRequests(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/course-join-requests`, { token });
}

/** POST .../course-join-requests/{id}/{decision} — approve | decline. Approve creates an Enrollment directly (requester is already a Member). */
export function decideCourseJoinRequest(token, slug, id, decision) {
  return request(`/workspaces/${encodeURIComponent(slug)}/course-join-requests/${id}/${decision}`, {
    method: "POST", token,
  });
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

/* ── Commercial (this Workspace's own subscription to the platform) ─────
   Separate from the Workspace's own commerce (pricing/orders/payouts for
   selling its courses — not built yet). This is what the Workspace pays
   the platform. No payment is collected here — checkout only issues an
   Invoice; a Platform Operator confirms it was settled externally.
   ------------------------------------------------------------------------ */

/** GET /api/catalog/plans → the public Solo plan catalog (no auth) */
export function getCommercialPlans() {
  return request("/catalog/plans");
}

/** GET /api/catalog/packs → the public Capability Pack catalog (no auth) */
export function getCommercialPacks() {
  return request("/catalog/packs");
}

/** GET /api/workspaces/{slug}/subscription → subscription + invoice + license + entitlements, or 404 if none yet */
export function getSubscription(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription`, { token });
}

/** POST .../subscription/checkout → { planCode, packCodes, billingCycle } */
export function checkoutSubscription(token, slug, body) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/checkout`, { method: "POST", body, token });
}

/** POST .../subscription/cancel — access continues until the current period ends. reason is optional and purely for the churn-signal audit trail. */
export function cancelSubscription(token, slug, reason) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/cancel`,
    { method: "POST", body: { reason: reason || null }, token });
}

/** POST .../subscription/downgrade — schedules a plan/pack change for the end of the current billing period (not immediate). Blocked with a message if current usage doesn't fit the target plan. */
export function downgradeSubscription(token, slug, planCode, packCodes) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/downgrade`,
    { method: "POST", body: { planCode, packCodes: packCodes ?? [] }, token });
}

/** POST .../subscription/upgrade — requests a plan/pack change and issues its prorated invoice; stays on the current plan until a Platform Operator confirms it. */
export function upgradeSubscription(token, slug, planCode, packCodes) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/upgrade`,
    { method: "POST", body: { planCode, packCodes: packCodes ?? [] }, token });
}

/** POST .../subscription/cancel-pending-change — backs out of a scheduled downgrade before it takes effect. */
export function cancelPendingSubscriptionChange(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/cancel-pending-change`, { method: "POST", token });
}

/** POST .../subscription/cancel-requested-change — withdraws an unconfirmed plan/pack change request before a Platform Operator acts on it. */
export function cancelRequestedSubscriptionChange(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/cancel-requested-change`, { method: "POST", token });
}

/** POST .../subscription/reactivate — undoes a Cancel while still within the paid period. */
export function reactivateSubscription(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/reactivate`, { method: "POST", token });
}

/** GET .../subscription/history → confirmed add-on/plan changes with a real before/after diff, newest first. */
export function getSubscriptionHistory(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/subscription/history`, { token });
}

/** GET /api/catalog/credit-packs → the public AI-credit top-up tiers (no auth) */
export function getCreditPackTiers() {
  return request("/catalog/credit-packs");
}

/** GET /api/workspaces/{slug}/credit-purchases → this workspace's top-up purchase history */
export function getCreditPurchases(token, slug) {
  return request(`/workspaces/${encodeURIComponent(slug)}/credit-purchases`, { token });
}

/** POST .../credit-purchases → { creditPackCode } — requests a top-up; a Platform Operator confirms payment before credits are granted. */
export function requestCreditPurchase(token, slug, creditPackCode) {
  return request(`/workspaces/${encodeURIComponent(slug)}/credit-purchases`,
    { method: "POST", body: { creditPackCode }, token });
}

export function cancelCreditPurchase(token, slug, orderId) {
  return request(`/workspaces/${encodeURIComponent(slug)}/credit-purchases/${encodeURIComponent(orderId)}/cancel`,
    { method: "POST", token });
}

/* ── Platform admin: subscriptions & invoices ────────────────────────────
   Manual Commercial Activation — a Platform Operator recording that
   commercial terms were satisfied outside this platform, in place of a
   payment-provider webhook.
   ------------------------------------------------------------------------ */

/** GET /api/admin/subscriptions → every Workspace's commercial state, attention-needing first */
export function getAdminSubscriptions(token) {
  return request("/admin/subscriptions", { token });
}

/** POST /api/admin/invoices/{id}/mark-paid */
export function markInvoicePaid(token, invoiceId, referenceNote) {
  return request(`/admin/invoices/${invoiceId}/mark-paid`, { method: "POST", body: { referenceNote }, token });
}

/** POST /api/admin/invoices/{id}/void — rejects an invoice nobody confirmed paying; withdraws any requested plan/pack change it was tied to. */
export function voidInvoice(token, invoiceId, referenceNote) {
  return request(`/admin/invoices/${invoiceId}/void`, { method: "POST", body: { referenceNote }, token });
}

/** POST /api/admin/invoices/sweep-overdue — marks every past-due Invoice Overdue and its Subscription PastDue */
export function sweepOverdueInvoices(token) {
  return request("/admin/invoices/sweep-overdue", { method: "POST", token });
}

/** POST /api/admin/subscriptions/sweep-renewals — rolls forward every Active subscription whose period has elapsed (applying a due downgrade, or a plain renewal) and grants that period's AI credits */
export function sweepDueRenewals(token) {
  return request("/admin/subscriptions/sweep-renewals", { method: "POST", token });
}

/** POST /api/admin/subscriptions/{id}/{action} — advance-to-grace | suspend | expire | apply-pending-change */
export function subscriptionAdminAction(token, subscriptionId, action) {
  return request(`/admin/subscriptions/${subscriptionId}/${action}`, { method: "POST", token });
}

/** GET /api/admin/credit-purchases → every Workspace's pending AI-credit top-up requests */
export function getAdminCreditPurchases(token) {
  return request("/admin/credit-purchases", { token });
}

/** POST /api/admin/credit-purchases/{id}/mark-paid — grants the purchased credits */
export function markCreditPurchasePaid(token, orderId, referenceNote) {
  return request(`/admin/credit-purchases/${orderId}/mark-paid`, { method: "POST", body: { referenceNote }, token });
}

/** POST /api/admin/credit-purchases/{id}/void — rejects a bogus/duplicate request; grants nothing */
export function voidCreditPurchase(token, orderId, referenceNote) {
  return request(`/admin/credit-purchases/${orderId}/void`, { method: "POST", body: { referenceNote }, token });
}

/* ── Platform admin: catalog (Products/Packs) ────────────────────────────
   Database-backed catalog management — "editing a price" always creates a
   new Draft version and publishes it, never patches an existing version.
   ------------------------------------------------------------------------ */

/** GET /api/admin/catalog/products */
export function getAdminProducts(token) {
  return request("/admin/catalog/products", { token });
}

/** POST /api/admin/catalog/products → { familyCode, code, name, version: {...} } */
export function createCatalogProduct(token, body) {
  return request("/admin/catalog/products", { method: "POST", body, token });
}

/** POST /api/admin/catalog/products/{id}/versions → { version: {...} } */
export function createProductVersion(token, productId, version) {
  return request(`/admin/catalog/products/${productId}/versions`, { method: "POST", body: { version }, token });
}

/** PUT /api/admin/catalog/products/{id}/versions/{versionId} → { version: {...} } */
export function updateProductVersion(token, productId, versionId, version) {
  return request(`/admin/catalog/products/${productId}/versions/${versionId}`, { method: "PUT", body: { version }, token });
}

/** POST /api/admin/catalog/products/{id}/versions/{versionId}/publish */
export function publishProductVersion(token, productId, versionId) {
  return request(`/admin/catalog/products/${productId}/versions/${versionId}/publish`, { method: "POST", token });
}

/** POST /api/admin/catalog/products/{id}/retire */
export function retireProduct(token, productId) {
  return request(`/admin/catalog/products/${productId}/retire`, { method: "POST", token });
}

/** GET /api/admin/catalog/packs */
export function getAdminPacks(token) {
  return request("/admin/catalog/packs", { token });
}

/** POST /api/admin/catalog/packs → { code, name, version: {...} } */
export function createPack(token, body) {
  return request("/admin/catalog/packs", { method: "POST", body, token });
}

/** POST /api/admin/catalog/packs/{id}/versions → { version: {...} } */
export function createPackVersion(token, packId, version) {
  return request(`/admin/catalog/packs/${packId}/versions`, { method: "POST", body: { version }, token });
}

/** PUT /api/admin/catalog/packs/{id}/versions/{versionId} → { version: {...} } */
export function updatePackVersion(token, packId, versionId, version) {
  return request(`/admin/catalog/packs/${packId}/versions/${versionId}`, { method: "PUT", body: { version }, token });
}

/** POST /api/admin/catalog/packs/{id}/versions/{versionId}/publish */
export function publishPackVersion(token, packId, versionId) {
  return request(`/admin/catalog/packs/${packId}/versions/${versionId}/publish`, { method: "POST", token });
}

/** POST /api/admin/catalog/packs/{id}/retire */
export function retirePack(token, packId) {
  return request(`/admin/catalog/packs/${packId}/retire`, { method: "POST", token });
}
