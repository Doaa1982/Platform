// Builds the one thing the browser test needs through the real API: a tutor with a lesson whose draft has a video.
// Nothing here touches a database directly.

async function call(base, method, path, { token, json, form } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: form ?? (json ? JSON.stringify(json) : undefined),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return body;
}

export async function seedTutorWithVideo({ apiBase, runId, videoBytes, videoName }) {
  const admin = await call(apiBase, "POST", "/api/auth/login", { json: { email: "admin@platform.com", password: "Test1234!" } });

  const slug = runId.toLowerCase();
  const email = `${slug}@e2e.local`;
  const provisioned = await call(apiBase, "POST", "/api/admin/workspaces", {
    token: admin.token,
    json: { name: `E2E ${runId}`, slug, ownerEmail: email, description: "Throwaway workspace for the browser test" },
  });
  const invitationToken = provisioned.invitationLink.split("/").pop();

  const accepted = await call(apiBase, "POST", `/api/invitations/${invitationToken}/accept`, {
    json: { fullName: "E2E Tutor", password: "E2E-Tutor-Passw0rd!" },
  });
  const token = accepted.token;

  for (const step of ["begin-configuration", "make-private", "publish", "activate"]) {
    await call(apiBase, "POST", `/api/workspaces/${slug}/setup/${step}`, { token });
  }

  const product = await call(apiBase, "POST", `/api/workspaces/${slug}/products`, {
    token, json: { title: "E2E course", description: "", category: null, tags: [], pacing: null, enrollmentMode: null, defaultLanguage: null },
  });

  await call(apiBase, "POST", `/api/workspaces/${slug}/products/${product.id}/curriculum/units`, { token, json: { title: "Unit 1" } });
  const withUnit = await call(apiBase, "GET", `/api/workspaces/${slug}/products/${product.id}/curriculum`, { token });
  const unitId = (withUnit.units ?? []).at(-1)?.id;
  if (!unitId) throw new Error("The unit was not created.");

  await call(apiBase, "POST", `/api/workspaces/${slug}/products/${product.id}/curriculum/lessons`, { token, json: { title: "Lesson with a video", unitId } });
  const curriculum = await call(apiBase, "GET", `/api/workspaces/${slug}/products/${product.id}/curriculum`, { token });
  const lessonId = curriculum.units.flatMap((u) => u.lessons ?? []).find((l) => l.title === "Lesson with a video")?.id;
  if (!lessonId) throw new Error("The lesson was not created.");

  const form = new FormData();
  form.append("file", new Blob([videoBytes], { type: "video/mp4" }), videoName);
  form.append("title", "E2E video");
  form.append("category", "Video");
  const asset = await call(apiBase, "POST", `/api/workspaces/${slug}/learning-assets`, { token, form });

  await call(apiBase, "POST", `/api/workspaces/${slug}/lessons/${lessonId}/draft/video`, { token, json: { learningAssetId: asset.id } });

  return {
    slug, lessonId, assetId: asset.id,
    session: { token, expiresAt: accepted.expiresAt, fullName: accepted.fullName ?? "E2E Tutor" },
  };
}
