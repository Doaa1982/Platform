import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle, Plus, RefreshCw, Send, Undo2,
  Globe, Archive, Pencil, BookOpen, Layers, X, Sparkles, Image as ImageIcon,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import InfoTip from "../components/InfoTip";
import Notice from "../components/Notice";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";
import Message from "../components/Message";
import { useLanguage } from "../i18n/useLanguage";

/* =========================================================================
   LEARNING PRODUCTS — what this workspace offers.

   A Learning Product is *what is offered*; a Curriculum is *what is taught*
   (Learning Product Aggregate Design §10). Only the offer exists so far, so a
   tutor can define, describe and publish a product — but there is nothing to
   put inside it yet.

   That is stated on every product rather than glossed over. INV-006 forbids
   publishing without a published Curriculum, and Curriculum is not built, so
   the rule cannot be enforced; a published product today is an announced
   intention, not something a learner can actually take.
   ========================================================================= */

/* Pacing (Learning Product Aggregate Design §8: SelfPaced / CohortBased /
   InstructorLed) is hidden from the form for now and every product is
   created and saved as SelfPaced — CohortBased and InstructorLed have no
   Scheduling Context behind them yet, so offering the choice would let a
   tutor pick a pacing this app can't actually deliver on. Reinstate the
   selector (see git history for the removed `PACING` options array + label)
   once scheduling exists. */
const DEFAULT_PACING = "SelfPaced";

/* Display names for EnrollmentMode (Learning Product Aggregate Design §8's
   "Enrollment Mode Hint") — casual, tutor-facing wording. The wire values
   (Open / InvitationOnly / ApprovalRequired) are the domain's own vocabulary
   and stay as they are; only what's shown on screen changed. */
const ENROLLMENT = [
  { value: "Open", labelKey: "products.enrollOpenLabel", helpKey: "products.enrollOpenHelp" },
  { value: "InvitationOnly", labelKey: "products.enrollInviteLabel", helpKey: "products.enrollInviteHelp" },
  { value: "ApprovalRequired", labelKey: "products.enrollApprovalLabel", helpKey: "products.enrollApprovalHelp" },
];
const enrollmentLabel = (t, value) => {
  const m = ENROLLMENT.find((m) => m.value === value);
  return m ? t(m.labelKey) : value;
};

/** Which transitions each status offers, mirroring §16's ordered machine. */
const ACTIONS = {
  Draft:       [{ key: "submit", labelKey: "products.actionSubmit", icon: Send },
                { key: "publish", labelKey: "products.actionPublish", icon: Globe }],
  UnderReview: [{ key: "publish", labelKey: "products.actionPublish", icon: Globe },
                { key: "return", labelKey: "products.actionReturn", icon: Undo2 }],
  Published:   [{ key: "unpublish", labelKey: "products.actionUnpublish", icon: Undo2 }],
  Archived:    [],
};

const TRANSITION_TOAST_KEY = {
  submit: "products.toastSubmitted", publish: "products.toastPublished",
  unpublish: "products.toastUnpublished", return: "products.toastReturned",
};

const STATUS_KEY = { Draft: "products.statusDraft", UnderReview: "products.statusUnderReview", Published: "products.statusPublished", Archived: "products.statusArchived" };
const human = (t, s) => t(STATUS_KEY[s] ?? "") || s;

/** A small, fixed palette so each product gets a stable "cover" color from its id — no image upload exists yet. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

export default function ProductsScreen({ onOpenStudio }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);   // product being edited, or "new"

  /* `editing` only identifies *which* product is open; its display values
     come from `data` so a toggle like sequential-unlock (applied immediately,
     outside the save form) shows its new state right away after `load()`
     refreshes `data`, instead of the stale snapshot captured when the panel
     was opened. */
  const liveEditing = editing === "new" ? "new"
    : editing && (data?.products.find((p) => p.id === editing.id) ?? editing);

  const load = useCallback(
    () => api.getProducts(session.token, slug)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    api.getProducts(session.token, slug)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      await load();
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !data) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <div className="lw-prod__loading"><LoaderCircle size={18} className="lw-prod__spin" /> {t("products.loading")}</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{t("products.eyebrow")}</div>
      <h1>{t("products.title")}</h1>
      <p className="lw-sub">{t("products.lead", { workspace: data.workspaceName })}</p>

      {error && !editing && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {data.canAuthor && (
        <div className="lw-prod__bar">
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> {t("products.newProduct")}
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} /> {t("products.refresh")}
          </button>
        </div>
      )}

      {editing && (
        <div className="lw-prod__overlay" role="dialog" aria-modal="true" onClick={() => setEditing(null)}>
          <div className="lw-prod__panel" onClick={(e) => e.stopPropagation()}>
            <button className="lw-prod__panelclose" onClick={() => setEditing(null)} aria-label={t("products.close")}><X size={16} /></button>
            <div className="lw-eyebrow">{editing === "new" ? t("products.newProduct") : t("products.editProduct")}</div>
            <h2 className="lw-prod__panelh2">{editing === "new" ? t("products.createHeading") : liveEditing.title}</h2>
            {error && <Message type="error">{error}</Message>}
            <ProductForm
              busy={busy}
              product={editing === "new" ? null : liveEditing}
              session={session}
              slug={slug}
              onCancel={() => setEditing(null)}
              onSubmit={async (body, newSequential, newCoverFile) => {
                const saved = await run(() => editing === "new"
                  ? api.createProduct(session.token, slug, body)
                  : api.updateProduct(session.token, slug, editing.id, body),
                  t(editing === "new" ? "products.toastCreated" : "products.toastSaved", { title: body.title }));
                if (saved) {
                  // No curriculum/asset exists yet to attach to until the
                  // product itself does — apply both as follow-ups now that it does.
                  if (editing === "new" && newSequential) {
                    await run(() => api.setSequentialUnlock(session.token, slug, saved.id, true));
                  }
                  if (editing === "new" && newCoverFile) {
                    await run(async () => {
                      const asset = await api.uploadLearningAsset(session.token, slug, newCoverFile, saved.title, undefined, "Image");
                      return api.attachProductCoverImage(session.token, slug, saved.id, asset.id);
                    });
                  }
                  setEditing(null);
                }
              }}
              onToggleSequential={() => run(() => api.setSequentialUnlock(
                session.token, slug, editing.id, !liveEditing.requiresSequentialCompletion))}
              onSetCoverImage={(file) => run(async () => {
                if (!file) return api.attachProductCoverImage(session.token, slug, editing.id, null);
                const asset = await api.uploadLearningAsset(session.token, slug, file, liveEditing.title, undefined, "Image");
                return api.attachProductCoverImage(session.token, slug, editing.id, asset.id);
              })}
            />
          </div>
        </div>
      )}

      {data.products.length === 0 && (
        <Notice tone="empty" icon={BookOpen} title={t("products.emptyTitle")}>
          <p>{data.canAuthor ? t("products.emptyCanAuthor") : t("products.emptyReadonly")}</p>
        </Notice>
      )}

      <div className="lw-prod__grid">
        {data.products.map((p) => {
          return (
            <div className={`lw-prod__card is-${p.status.toLowerCase()}`} key={p.id}>
              <div className={`lw-prod__cover ${p.coverImageAssetId ? "" : `lw-cover--${coverVariant(p.id)}`}`}>
                {p.coverImageAssetId ? (
                  <img className="lw-prod__coverimg" alt="" src={api.learningAssetDownloadUrl(session.token, slug, p.coverImageAssetId)} />
                ) : (
                  <span className="lw-prod__monogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
                )}
                <span className={`lw-prod__pill is-${p.status.toLowerCase()}`}>{human(t, p.status)}</span>
              </div>

              <div className="lw-prod__body">
                <div className="lw-prod__title">{p.title}</div>

                {/* Display only — one property per row, label in its own column. */}
                <div className="lw-prod__proplist">
                  <span className="lw-prod__proplabel">📝 {t("products.descriptionLabel")}</span>
                  {p.description
                    ? <span className="lw-prod__propvalue">{p.description}</span>
                    : <span className="lw-prod__propvalue is-empty">{t("products.noDescription")}</span>}

                  <span className="lw-prod__proplabel">🔓 {t("products.whoCanJoin")}</span>
                  <span className="lw-prod__propvalue">{enrollmentLabel(t, p.enrollmentMode)}</span>

                  {p.category && (
                    <>
                      <span className="lw-prod__proplabel">🏷️ {t("products.category")}</span>
                      <span className="lw-prod__propvalue">{p.category}</span>
                    </>
                  )}

                  {p.defaultLanguage && (
                    <>
                      <span className="lw-prod__proplabel">🌐 {t("products.language")}</span>
                      <span className="lw-prod__propvalue">{p.defaultLanguage}</span>
                    </>
                  )}

                  {p.tags.length > 0 && (
                    <>
                      <span className="lw-prod__proplabel">🔖 {t("products.tags")}</span>
                      <span className="lw-prod__propvalue">{p.tags.join(", ")}</span>
                    </>
                  )}

                  <span className="lw-prod__proplabel">📚 {t("products.curriculum")}</span>
                  {p.hasCurriculum
                    ? <span className="lw-prod__propvalue is-ready">{t("products.curriculumPublished")}</span>
                    : <span className="lw-prod__propvalue is-empty">{t("products.curriculumNotPublished")}</span>}
                </div>
              </div>

              {data.canAuthor && p.status !== "Archived" && (
                <div className="lw-prod__actions">
                  <button disabled={busy} onClick={() => setEditing(p)}><Pencil size={12} /> {t("products.edit")}</button>
                  {onOpenStudio && (
                    <button disabled={busy} onClick={() => onOpenStudio(p.id)}>
                      <Layers size={12} /> {p.hasCurriculum ? t("products.curriculumBtn") : t("products.buildCurriculum")}
                    </button>
                  )}
                  {(ACTIONS[p.status] ?? []).map((a) => (
                    <button key={a.key} disabled={busy}
                            onClick={() => run(() => api.productTransition(session.token, slug, p.id, a.key),
                              t(TRANSITION_TOAST_KEY[a.key], { title: p.title }))}>
                      <a.icon size={12} /> {t(a.labelKey)}
                    </button>
                  ))}
                  <button disabled={busy}
                          onClick={() => {
                            if (!window.confirm(t("products.confirmArchive", { title: p.title }))) return;
                            run(() => api.productTransition(session.token, slug, p.id, "archive"),
                              t("products.toastArchived", { title: p.title }));
                          }}>
                    <Archive size={12} /> {t("products.archive")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!data.canAuthor && data.products.length > 0 && (
        <Notice tone="readonly">{t("products.readonlyNote")}</Notice>
      )}
    </div>
  );
}

function ProductForm({ product, onSubmit, onCancel, busy, onToggleSequential, onSetCoverImage, session, slug }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(product?.title ?? "");
  const coverInputRef = useRef(null);
  // While creating: staged locally and applied as a follow-up once the
  // product exists (mirrors newSequential below). While editing: applied
  // immediately via onSetCoverImage, same as the sequential-unlock toggle.
  const [newCoverFile, setNewCoverFile] = useState(null);
  const [newCoverPreviewUrl, setNewCoverPreviewUrl] = useState(null);
  const [coverCleared, setCoverCleared] = useState(false);

  function handleCoverChange(file) {
    if (!file) return;
    if (product) {
      onSetCoverImage(file);
    } else {
      setNewCoverFile(file);
      setNewCoverPreviewUrl(URL.createObjectURL(file));
    }
  }

  function handleClearCover() {
    if (product) {
      onSetCoverImage(null);
      setCoverCleared(true);
    } else {
      setNewCoverFile(null);
      setNewCoverPreviewUrl(null);
    }
  }

  const coverPreviewSrc = newCoverPreviewUrl
    || (product?.coverImageAssetId && !coverCleared ? api.learningAssetDownloadUrl(session.token, slug, product.coverImageAssetId) : null);
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [enrollmentMode, setEnrollmentMode] = useState(product?.enrollmentMode ?? "Open");
  const [defaultLanguage, setDefaultLanguage] = useState(product?.defaultLanguage ?? "");
  const [attempted, setAttempted] = useState(false);

  // AI Capability Architecture §8 "Generate Description" — drafts from
  // whatever's typed so far; works before the product is even saved.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  async function suggestDescription() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await api.suggestProductDescription(session.token, slug, {
        title: title.trim(),
        category: category.trim() || null,
        tags: tags.split(",").map((tg) => tg.trim()).filter(Boolean),
      });
      setDescription(r.description);
    } catch (e) { setAiError(e.message); }
    finally { setAiBusy(false); }
  }

  /* No product exists yet while creating, so there is nothing to toggle live
     against (setSequentialUnlock needs a real product id) — this is just
     the intended starting value, applied as a follow-up call once
     "Create product" actually creates the row. */
  const [newSequential, setNewSequential] = useState(false);
  const sequentialOn = product ? product.requiresSequentialCompletion : newSequential;

  return (
    <form
      className="lw-prod__form" noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) { setAttempted(true); return; }
        onSubmit({
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          pacing: DEFAULT_PACING, enrollmentMode,
          defaultLanguage: defaultLanguage.trim() || null,
        }, newSequential, newCoverFile);
      }}
    >
      {attempted && !title.trim() && (
        <Message type="error">{t("products.titleRequired")}</Message>
      )}
      <label>
        <span>{t("products.titleLabel")}<RequiredMark /></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
               placeholder={t("products.titlePlaceholder")} disabled={busy}
               style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
      </label>
      <label>
        <span>{t("products.coverPhoto")}</span>
        <div className="lw-prod__coverupload">
          {coverPreviewSrc && <img className="lw-prod__coverpreview" src={coverPreviewSrc} alt="" />}
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }}
                 onChange={(e) => handleCoverChange(e.target.files?.[0])} />
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy}
                  onClick={() => coverInputRef.current?.click()}>
            <ImageIcon size={12} /> {coverPreviewSrc ? t("products.changePhoto") : t("products.choosePhoto")}
          </button>
          {coverPreviewSrc && (
            <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={handleClearCover}>
              <X size={12} /> {t("products.removePhoto")}
            </button>
          )}
        </div>
      </label>
      <label>
        <span className="lw-prod__desclabel">
          {t("products.descriptionLabel")}
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={suggestDescription}
                  disabled={busy || aiBusy || !title.trim()} title={t("products.aiSuggestDescription")}>
            {aiBusy
              ? <LoaderCircle size={12} className="lw-prod__spin" />
              : <Sparkles size={12} />} {t("products.aiSuggestDescription")}
          </button>
        </span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("products.descPlaceholder")} disabled={busy} />
        {aiError && <Message type="error">{aiError}</Message>}
      </label>
      <label>
        <span>{t("products.whoCanJoin")} <InfoTip text={t(ENROLLMENT.find((m) => m.value === enrollmentMode)?.helpKey ?? "")} /></span>
        <select value={enrollmentMode} onChange={(e) => setEnrollmentMode(e.target.value)} disabled={busy}>
          {ENROLLMENT.map((m) => <option key={m.value} value={m.value}>{t(m.labelKey)}</option>)}
        </select>
      </label>
      <label>
        <span>{t("products.lessonOrder")} <InfoTip text={t("products.lessonOrderTip")} /></span>
        <button type="button" role="switch" aria-checked={sequentialOn}
                aria-label={t("products.lessonOrderAria")}
                className={`lw-toggle ${sequentialOn ? "is-on" : ""}`}
                disabled={busy}
                onClick={product ? onToggleSequential : () => setNewSequential((v) => !v)}>
          <span />
        </button>
      </label>
      <label>
        <span>{t("products.category")}</span>
        <input value={category} onChange={(e) => setCategory(e.target.value)}
               placeholder={t("products.categoryPlaceholder")} disabled={busy} />
      </label>
      <label>
        <span>{t("products.language")}</span>
        <input value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}
               placeholder={t("products.languagePlaceholder")} disabled={busy} />
      </label>
      <label>
        <span>{t("products.tags")} <em>{t("products.tagsHint")}</em></span>
        <input value={tags} onChange={(e) => setTags(e.target.value)}
               placeholder={t("products.tagsPlaceholder")} disabled={busy} />
      </label>

      <div className="lw-prod__formactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>{t("products.cancel")}</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
          {busy ? <LoaderCircle size={14} className="lw-prod__spin" /> : product ? t("products.saveChanges") : t("products.createProduct")}
        </button>
      </div>
    </form>
  );
}

const CSS = `
  .lw-prod__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-prod__bar { display: flex; gap: 8px; margin-bottom: 18px; }

  /* UIC-003: every field is a property-name / value row in one shared grid,
     rather than a label stacked above its control. */
  .lw-prod__form { display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start; }
  .lw-prod__form > label { display: contents; }
  .lw-prod__form label > span:first-child { font-size: 0.78rem; font-weight: 600; padding-top: 9px; white-space: nowrap; }
  .lw-prod__form em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .lw-prod__form input, .lw-prod__form textarea, .lw-prod__form select {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }
  .lw-prod__formactions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }
  .lw-prod__desclabel { display: flex !important; align-items: center; gap: 8px; white-space: normal !important; }
  .lw-btn--xs { font-size: 0.72rem; padding: 3px 8px; gap: 4px; }
  @media (max-width: 560px) {
    .lw-prod__form { grid-template-columns: 1fr; }
    .lw-prod__form > label { display: flex; flex-direction: column; gap: 5px; }
    .lw-prod__form label > span:first-child { padding-top: 0; white-space: normal; }
  }

  .lw-prod__grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;
  }
  .lw-prod__card {
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); overflow: hidden;
  }
  .lw-prod__card.is-archived { opacity: 0.55; }

  .lw-prod__cover {
    height: 64px; flex-shrink: 0; position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .lw-prod__monogram { font-family: var(--font-display); font-size: 1.5rem; font-weight: 600; color: rgba(255,255,255,0.92); }
  .lw-prod__coverimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .lw-prod__coverupload { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .lw-prod__coverpreview { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; border: 1px solid var(--line); flex-shrink: 0; }
  .lw-prod__cover .lw-prod__pill { position: absolute; top: 9px; inset-inline-end: 9px; background: rgba(10,12,15,0.4); color: #fff; }
  .lw-cover--0 { background: linear-gradient(135deg, #2D5BD1, #6D3FC4); }
  .lw-cover--1 { background: linear-gradient(135deg, #1E7F63, #5B8DEF); }
  .lw-cover--2 { background: linear-gradient(135deg, #E0A83E, #C4533F); }
  .lw-cover--3 { background: linear-gradient(135deg, #0EA5A5, #6D3FC4); }
  .lw-cover--4 { background: linear-gradient(135deg, #D1477A, #E0A83E); }

  .lw-prod__body { flex: 1; padding: 13px 15px 4px; }
  .lw-prod__title { font-weight: 600; font-size: 0.98rem; }

  /* Display only, one property per row: label (with its emoji) in the left
     column, value in the right — never two properties sharing a line. */
  .lw-prod__proplist {
    display: grid; grid-template-columns: max-content 1fr;
    row-gap: 7px; column-gap: 12px; margin-top: 11px; font-size: 0.82rem;
  }
  .lw-prod__proplabel { color: var(--ink-soft); white-space: nowrap; }
  .lw-prod__propvalue { color: var(--ink); line-height: 1.5; word-break: break-word; }
  .lw-prod__propvalue.is-empty { color: var(--ink-soft); font-style: italic; }
  .lw-prod__propvalue.is-ready { color: var(--accent-2); font-weight: 600; }

  .lw-prod__overlay {
    position: fixed; inset: 0; background: rgba(10,12,15,0.55);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px; z-index: 50; overflow-y: auto;
  }
  .lw-prod__panel {
    background: var(--surface); color: var(--ink); border-radius: var(--radius);
    max-width: 640px; width: 100%; padding: 30px 32px 34px; position: relative;
  }
  .lw-prod__panelclose { position: absolute; top: 18px; inset-inline-end: 18px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
  .lw-prod__panelclose:hover { color: var(--ink); }
  .lw-prod__panelh2 { margin: 2px 0 18px; text-align: center; }

  .lw-toggle {
    width: 40px; height: 22px; border-radius: 20px; background: var(--line); border: none;
    cursor: pointer; position: relative; flex-shrink: 0; transition: background .15s;
  }
  .lw-toggle span {
    position: absolute; top: 2px; inset-inline-start: 2px; width: 18px; height: 18px; border-radius: 50%;
    background: #fff; transition: inset-inline-start .15s; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .lw-toggle.is-on { background: var(--accent-2); }
  .lw-toggle.is-on span { inset-inline-start: 20px; }
  .lw-toggle:disabled { opacity: 0.5; cursor: not-allowed; }

  .lw-prod__pill {
    font-family: var(--font-mono); font-size: 10px; border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-prod__pill.is-published { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-prod__pill.is-underreview { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

  .lw-prod__actions { display: flex; gap: 5px; flex-wrap: wrap; padding: 12px 15px 15px; }
  .lw-prod__actions button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-body); font-size: 11px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .lw-prod__actions button:hover:not(:disabled) { color: var(--ink); }
  .lw-prod__actions button:disabled { opacity: 0.45; cursor: not-allowed; }

  .lw-prod__spin { animation: lwProdSpin 0.9s linear infinite; }
  @keyframes lwProdSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-prod__spin { animation: none; } }
`;
