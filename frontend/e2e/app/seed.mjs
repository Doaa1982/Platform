/* =========================================================================
   Seeds a realistic academy through the real API, for recording the in-app
   audit's fixtures: an owner with a published Arabic course, an enrolled
   learner, a pending invitation and join request, and a pending tutor
   application for the admin queue.

   All user-written content is Arabic on purpose: on an Arabic screen, any
   Latin text that remains is then untranslated UI (or an email/brand, which
   the audit allows) — never an ambiguous mix of UI and data.
   ========================================================================= */

async function call(base, method, path, { token, json } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const LESSONS = [
  { title: "مساحة شبه المنحرف", body: "في هذا الدرس نتعلم قانون مساحة شبه المنحرف: نصف مجموع القاعدتين مضروبًا في الارتفاع. نحل ثلاثة أمثلة خطوة بخطوة." },
  { title: "مساحة الدائرة", body: "نتعرف على الثابت باي، ثم نستخدم القانون لحساب مساحة الدائرة إذا عرفنا نصف القطر أو القطر." },
];

export async function seedAcademy({ apiBase, admin }) {
  const api = (method, path, opts) => call(apiBase, method, path, opts);
  const adminToken = (await api("POST", "/api/auth/login", { json: admin })).token;

  // ── Tutor: apply → approve → provision → accept ──────────────────────────
  const slug = "al-noor";
  const ownerEmail = "mohamed.ali@example.com";
  const applied = await api("POST", "/api/signup-requests", { json: { fullName: "محمد علي", email: ownerEmail, about: "أدرّس الرياضيات للمرحلة الإعدادية." } });
  await api("POST", `/api/admin/signup-requests/${applied.requestId}/approve`, { token: adminToken });
  const provisioned = await api("POST", `/api/admin/signup-requests/${applied.requestId}/provision`, {
    token: adminToken, json: { name: "أكاديمية النور", slug, ownerEmail, description: "دروس رياضيات ولغة عربية للصفوف من السابع إلى التاسع." },
  });
  const owner = await api("POST", `/api/invitations/${provisioned.invitationLink.split("/").pop()}/accept`, {
    json: { fullName: "محمد علي", password: "Owner-Audit-Passw0rd!" },
  });
  const ownerToken = owner.token;
  for (const step of ["begin-configuration", "make-private", "publish", "activate"]) {
    await api("POST", `/api/workspaces/${slug}/setup/${step}`, { token: ownerToken });
  }
  await api("PUT", `/api/workspaces/${slug}/setup/branding`, {
    token: ownerToken, json: { logoAssetId: null, welcomeMessage: "أهلًا بك في أكاديمية النور. نتعلم معًا خطوة بخطوة.", courseCategories: ["الرياضيات", "اللغة العربية"] },
  });
  await api("PUT", `/api/workspaces/${slug}/setup/join-requests`, { token: ownerToken, json: { accepts: true } });

  // A paid plan, so AI and assessment features are on (same path the integration tests use).
  const upgraded = await api("POST", `/api/workspaces/${slug}/subscription/upgrade`, { token: ownerToken, json: { planCode: "solo-professional", packCodes: [] } });
  await api("POST", `/api/admin/invoices/${upgraded.currentInvoiceId}/mark-paid`, { token: adminToken, json: { referenceNote: "تفعيل تجريبي" } });

  // ── A published course with two reading lessons ───────────────────────────
  const product = await api("POST", `/api/workspaces/${slug}/products`, {
    token: ownerToken,
    json: { title: "الرياضيات للصف الثامن", description: "منهج الرياضيات للصف الثامن بشرح مبسّط وأمثلة محلولة.", category: "الرياضيات", tags: [], pacing: null, enrollmentMode: null, defaultLanguage: "ar" },
  });
  const curriculumPath = `/api/workspaces/${slug}/products/${product.id}/curriculum`;
  await api("POST", `${curriculumPath}/units`, { token: ownerToken, json: { title: "الوحدة الأولى: المساحات" } });
  const unitId = (await api("GET", curriculumPath, { token: ownerToken })).units.at(-1).id;
  const lessonIds = [];
  for (const lesson of LESSONS) {
    await api("POST", `${curriculumPath}/lessons`, { token: ownerToken, json: { title: lesson.title, unitId } });
    const id = (await api("GET", curriculumPath, { token: ownerToken })).units.flatMap((u) => u.lessons).find((l) => l.title === lesson.title).id;
    await api("PUT", `/api/workspaces/${slug}/lessons/${id}/draft`, {
      token: ownerToken, json: { title: lesson.title, body: lesson.body, estimatedMinutes: 20, deliveryMode: "Reading" },
    });
    await api("POST", `/api/workspaces/${slug}/lessons/${id}/publish`, { token: ownerToken });
    lessonIds.push(id);
  }
  await api("POST", `${curriculumPath}/publish`, { token: ownerToken });
  await api("POST", `/api/workspaces/${slug}/products/${product.id}/submit`, { token: ownerToken });
  await api("POST", `/api/workspaces/${slug}/products/${product.id}/publish`, { token: ownerToken });

  // ── A learner, enrolled ───────────────────────────────────────────────────
  const learnerEmail = "sara.ahmed@example.com";
  const invited = await api("POST", `/api/workspaces/${slug}/invitations`, { token: ownerToken, json: { email: learnerEmail, role: "Learner" } });
  const learner = await api("POST", `/api/invitations/${invited.invitationLink.split("/").pop()}/accept`, {
    json: { fullName: "سارة أحمد", password: "Learner-Audit-Passw0rd!" },
  });
  const members = await api("GET", `/api/workspaces/${slug}/members`, { token: ownerToken });
  const learnerMembership = members.members.find((m) => m.email === learnerEmail).membershipId;
  await api("POST", `/api/workspaces/${slug}/members/${learnerMembership}/enroll`, { token: ownerToken, json: { learningProductId: product.id } });

  // ── Things waiting for someone ────────────────────────────────────────────
  await api("POST", `/api/workspaces/${slug}/invitations`, { token: ownerToken, json: { email: "omar.hassan@example.com", role: "Learner" } });
  await api("POST", `/api/workspaces/${slug}/join`, { json: { fullName: "ليلى سعيد", email: "laila.saeed@example.com", message: "أرغب في الانضمام إلى دورة الرياضيات." } });
  await api("POST", "/api/signup-requests", { json: { fullName: "هدى مصطفى", email: "huda.mostafa@example.com", about: "معلمة لغة عربية للمرحلة الابتدائية." } });

  return {
    slug, productId: product.id, lessonIds,
    sessions: {
      owner: { token: ownerToken, expiresAt: owner.expiresAt, fullName: "محمد علي" },
      learner: { token: learner.token, expiresAt: learner.expiresAt, fullName: "سارة أحمد" },
      admin: { token: adminToken, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), fullName: "Admin" },
    },
  };
}
