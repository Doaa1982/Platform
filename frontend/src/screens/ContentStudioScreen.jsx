import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, RefreshCw, ArrowLeft, X, Trash2,
  Globe, Undo2, Archive, Layers, FileText, Pencil, Check, BookOpen,
  UploadCloud, Sparkles, Bot, PlayCircle, Link as LinkIcon,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";

/* =========================================================================
   CONTENT STUDIO — building the curriculum of one Learning Product.

   Curriculum Aggregate Design §10: a Learning Product is *what is offered*;
   a Curriculum is *what is taught*. This screen is where a tutor builds that
   substance — Curriculum Units, and the Lessons placed inside them.

   A Curriculum is created lazily: adding the first unit or lesson creates
   it, so a product with nothing built yet and a product with an empty
   curriculum are told apart honestly rather than one standing in for both.

   Structure can only change while the Curriculum is not Published (Curriculum
   Aggregate Design §15/RequireEditable) — a learner partway through a course
   should not have units appear and vanish beneath them. Unpublishing is the
   way back in.
   ========================================================================= */

const human = (s) => (s ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");

const formatTime = (seconds) => {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function ContentStudioScreen({ productId, onSelectProduct }) {
  // Keyed by productId so picking a different product (without leaving this
  // screen first) remounts the builder fresh, rather than needing an effect
  // to reset state for a prop that changed out from under it.
  return productId
    ? <CurriculumBuilder key={productId} productId={productId} onBack={() => onSelectProduct(null)} />
    : <ProductPicker onSelect={onSelectProduct} />;
}

/* ── Step 1: which product ────────────────────────────────────────────── */

function ProductPicker({ onSelect }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getProducts(session.token, slug)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  if (error) {
    return <div className="lw-page"><div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">Content Studio</div>
      <h1>What do you want to build?</h1>
      <p className="lw-sub">
        Pick a learning product to open its curriculum — the units and lessons
        that make up what it actually teaches.
      </p>

      {data.products.length === 0 && (
        <div className="lw-studio__empty">
          <BookOpen size={26} />
          <h2>No learning products yet</h2>
          <p>Create one in Learning Products first — a curriculum belongs to a product.</p>
        </div>
      )}

      <div className="lw-studio__cardgrid">
        {data.products.map((p) => (
          <button className="lw-studio__card" key={p.id} onClick={() => onSelect(p.id)}>
            <div className={`lw-studio__cardcover lw-cover--${coverVariant(p.id)}`}>
              <span className="lw-studio__cardmonogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
              <span className={`lw-studio__pill is-${p.status.toLowerCase()}`}>{human(p.status)}</span>
            </div>
            <div className="lw-studio__cardbody">
              <div className="lw-studio__cardtitle">{p.title}</div>
              {p.hasCurriculum
                ? <span className="lw-studio__pickhas"><Layers size={11} /> Has a published curriculum</span>
                : <span className="lw-studio__picknone">Nothing built yet</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small, fixed palette so each product gets a stable "cover" color from its id — no image upload exists yet. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

/* ── Step 2: the curriculum itself ────────────────────────────────────── */

function CurriculumBuilder({ productId, onBack }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openLessonId, setOpenLessonId] = useState(null);

  const load = useCallback(
    () => api.getCurriculum(session.token, slug, productId)
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; }),
    [session.token, slug, productId]);

  useEffect(() => {
    let cancelled = false;
    api.getCurriculum(session.token, slug, productId)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug, productId]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { return await fn(); }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> Loading…</div>
      </div>
    );
  }

  const editable = data.canAuthor && data.status !== "Published" && data.status !== "Archived";

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <BackLink onBack={onBack} />

      <div className="lw-eyebrow">Content Studio · {data.productTitle} ({human(data.productStatus)})</div>
      <div className="lw-studio__heading">
        <h1>{data.title ?? "Curriculum"}</h1>
        <span className={`lw-studio__pill is-${data.status.toLowerCase()}`}>{human(data.status)}</span>
      </div>
      <p className="lw-sub">
        What {data.productTitle} teaches, organized into units in the order a
        learner moves through them.
      </p>

      {error && <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>}

      {data.canAuthor && (
        <div className="lw-studio__bar">
          {data.status === "Published" ? (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                    onClick={() => run(() => api.curriculumTransition(session.token, slug, productId, "unpublish")).then(load)}>
              <Undo2 size={13} /> Unpublish to edit
            </button>
          ) : data.status !== "Archived" && (
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!data.publicationBlocker}
                    onClick={() => run(() => api.curriculumTransition(session.token, slug, productId, "publish")).then(load)}>
              <Globe size={13} /> Publish curriculum
            </button>
          )}
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {data.publicationBlocker && (
        <div className="lw-studio__blocker"><AlertCircle size={14} /> {data.publicationBlocker}</div>
      )}

      {editable && !data.publicationBlocker && data.status !== "Published" && (
        <p className="muted" style={{ margin: "-6px 0 16px" }}>
          Publishing makes the curriculum's current units and lessons visible to learners. You
          can unpublish anytime to keep editing — nothing is locked in.
        </p>
      )}

      {editable && (
        <NewUnitForm busy={busy} onAdd={(title) =>
          run(() => api.addUnit(session.token, slug, productId, title)).then(load)} />
      )}

      {data.units.length === 0 && (
        <div className="lw-studio__empty">
          <Layers size={26} />
          {editable ? (
            <>
              <h2>Let's build your curriculum</h2>
              <ol className="lw-studio__steps">
                <li><strong>Add a unit</strong> above — a module, week or chapter a learner moves through in order.</li>
                <li><strong>Add lessons</strong> inside that unit.</li>
                <li><strong>Open a lesson</strong> to write its content. Save a draft while you work; publish when it's ready for learners.</li>
              </ol>
            </>
          ) : (
            <>
              <h2>No units yet</h2>
              <p>This curriculum has no units.</p>
            </>
          )}
        </div>
      )}

      <div className="lw-studio__units">
        {data.units.map((u) => (
          <UnitCard
            key={u.id} unit={u} editable={editable} busy={busy}
            unplacedLessons={data.unplacedLessons}
            onOpenLesson={setOpenLessonId}
            onRename={(title) => run(() => api.renameUnit(session.token, slug, productId, u.id, title)).then(load)}
            onRemove={() => run(() => api.removeUnit(session.token, slug, productId, u.id)).then(load)}
            onCreateLesson={(title) => run(() => api.createLesson(session.token, slug, productId, title, u.id)).then(load)}
            onPlaceExisting={(lessonId) => run(() => api.placeLesson(session.token, slug, productId, u.id, lessonId)).then(load)}
            onUnplace={(lessonId) => run(() => api.unplaceLesson(session.token, slug, productId, u.id, lessonId)).then(load)}
          />
        ))}
      </div>

      {data.unplacedLessons.length > 0 && (
        <>
          <h2 className="lw-sectiontitle">Not yet in a unit</h2>
          <p className="lw-sub" style={{ marginTop: -8 }}>
            Lessons that belong to this product but aren't placed anywhere in the
            curriculum yet — a learner following the curriculum won't reach these.
          </p>
          <div className="lw-studio__lessonlist">
            {data.unplacedLessons.map((l) => (
              <LessonRowView key={l.id} lesson={l} onOpen={() => setOpenLessonId(l.id)} />
            ))}
          </div>
        </>
      )}

      {editable && data.units.length === 0 && (
        <>
          <p className="muted" style={{ marginTop: 14 }}>
            Prefer to start writing before you've organized units? You can create a lesson now
            and place it in a unit later.
          </p>
          <NewLessonOnlyForm busy={busy}
            onAdd={(title) => run(() => api.createLesson(session.token, slug, productId, title, null)).then(load)} />
        </>
      )}

      {!data.canAuthor && (
        <p className="lw-studio__readonly">
          You're viewing this curriculum. Only an owner, administrator or teacher can change it.
        </p>
      )}

      {openLessonId && (
        <LessonEditor
          key={openLessonId}
          lessonId={openLessonId}
          onClose={() => setOpenLessonId(null)}
          onChanged={load}
          onDuplicated={setOpenLessonId}
        />
      )}
    </div>
  );
}

function BackLink({ onBack }) {
  return (
    <button className="lw-studio__back" onClick={onBack}>
      <ArrowLeft size={13} /> All products
    </button>
  );
}

function NewUnitForm({ busy, onAdd }) {
  const [title, setTitle] = useState("");
  const [attempted, setAttempted] = useState(false);
  return (
    <form className="lw-studio__newunit"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) { setAttempted(true); return; }
            onAdd(title.trim()); setTitle(""); setAttempted(false);
          }}>
      <div style={{ flex: 1 }}>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setAttempted(false); }} disabled={busy}
               placeholder="New unit — e.g. “Week 1: Getting started”"
               style={{ width: "100%", ...(attempted ? invalidFieldStyle : {}) }} />
        {attempted && <span className="lw-studio__fielderror">Enter a title first.</span>}
      </div>
      <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
        <Plus size={13} /> Add unit
      </button>
    </form>
  );
}

function NewLessonOnlyForm({ busy, onAdd }) {
  const [title, setTitle] = useState("");
  const [attempted, setAttempted] = useState(false);
  return (
    <form className="lw-studio__newunit"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) { setAttempted(true); return; }
            onAdd(title.trim()); setTitle(""); setAttempted(false);
          }}>
      <div style={{ flex: 1 }}>
        <input value={title} onChange={(e) => { setTitle(e.target.value); setAttempted(false); }} disabled={busy}
               placeholder="Or start a lesson before you have units"
               style={{ width: "100%", ...(attempted ? invalidFieldStyle : {}) }} />
        {attempted && <span className="lw-studio__fielderror">Enter a title first.</span>}
      </div>
      <button type="submit" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}>
        <FileText size={13} /> New lesson
      </button>
    </form>
  );
}

function UnitCard({
  unit, editable, busy, unplacedLessons, onOpenLesson,
  onRename, onRemove, onCreateLesson, onPlaceExisting, onUnplace,
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(unit.title);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [lessonAttempted, setLessonAttempted] = useState(false);

  return (
    <div className="lw-studio__unit">
      <div className="lw-studio__unithead">
        {renaming ? (
          <form
            className="lw-studio__renameform"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim() && title.trim() !== unit.title) onRename(title.trim());
              setRenaming(false);
            }}
          >
            <input value={title} autoFocus disabled={busy}
                   onChange={(e) => setTitle(e.target.value)}
                   onBlur={() => {
                     if (title.trim() && title.trim() !== unit.title) onRename(title.trim());
                     setRenaming(false);
                   }} />
            <button type="submit" aria-label="Save"><Check size={13} /></button>
          </form>
        ) : (
          <span className="lw-studio__unittitle">
            <span className="lw-studio__unitnum">{unit.position + 1}</span> {unit.title}
          </span>
        )}
        {editable && !renaming && (
          <div className="lw-studio__unitactions">
            <button aria-label="Rename unit" onClick={() => { setTitle(unit.title); setRenaming(true); }}><Pencil size={12} /></button>
            <button aria-label="Remove unit" onClick={onRemove}><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      {unit.lessons.length === 0 && (
        <div className="lw-studio__unitempty">
          {editable ? "No lessons in this unit yet — add one below." : "No lessons in this unit yet."}
        </div>
      )}

      <div className="lw-studio__lessonlist">
        {unit.lessons.map((l) => (
          <LessonRowView key={l.id} lesson={l} onOpen={() => onOpenLesson(l.id)}
                          onRemove={editable ? () => onUnplace(l.id) : null} />
        ))}
      </div>

      {editable && (
        <div className="lw-studio__addlesson">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newLessonTitle.trim()) { setLessonAttempted(true); return; }
              onCreateLesson(newLessonTitle.trim()); setNewLessonTitle(""); setLessonAttempted(false);
            }}
          >
            <div style={{ flex: 1 }}>
              <input value={newLessonTitle} onChange={(e) => { setNewLessonTitle(e.target.value); setLessonAttempted(false); }}
                     placeholder="New lesson title" disabled={busy}
                     style={{ width: "100%", ...(lessonAttempted ? invalidFieldStyle : {}) }} />
              {lessonAttempted && <span className="lw-studio__fielderror">Enter a title first.</span>}
            </div>
            <button type="submit" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}>
              <Plus size={12} /> Add lesson
            </button>
          </form>
          {unplacedLessons.length > 0 && (
            <select disabled={busy} defaultValue=""
                    onChange={(e) => { if (e.target.value) { onPlaceExisting(e.target.value); e.target.value = ""; } }}>
              <option value="" disabled>Place an existing lesson…</option>
              {unplacedLessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

function LessonRowView({ lesson, onOpen, onRemove }) {
  return (
    <div className="lw-studio__lessonrow">
      <button className="lw-studio__lessonopen" onClick={onOpen}>
        <FileText size={13} />
        <span className="lw-studio__lessontitle">{lesson.title}</span>
        <span className={`lw-studio__pill is-${lesson.status.toLowerCase()}`}>{human(lesson.status)}</span>
        {lesson.hasOpenDraft && <span className="lw-studio__pill is-draftopen">Draft open</span>}
        {lesson.estimatedMinutes != null && <span className="lw-studio__mins">{lesson.estimatedMinutes} min</span>}
      </button>
      {onRemove && (
        <button className="lw-studio__lessonremove" aria-label="Remove from unit" onClick={onRemove}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Lesson editor overlay ─────────────────────────────────────────────── */

function LessonEditor({ lessonId, onClose, onChanged, onDuplicated }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [minutes, setMinutes] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("Recorded");
  const [videoDuration, setVideoDuration] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  // Lesson Editing & Publication UX, Scenario 5: replacing the video or
  // changing delivery mode on a published lesson (no open draft) starts a new
  // version — this dialog is the "choose how to continue" step. Null when
  // closed; "video" | "delivery" records which action opened it, purely to
  // pick the right copy.
  const [versionDialogTrigger, setVersionDialogTrigger] = useState(null);
  const [pendingDeliveryMode, setPendingDeliveryMode] = useState(null);

  const load = useCallback(
    () => api.getLesson(session.token, slug, lessonId).then((l) => {
      setLesson(l);
      // No open draft doesn't mean nothing to show — a Published lesson with
      // no draft is exactly the quick-edit case (Scenario 3), so the form
      // falls back to the current revision's own values, not blanks.
      const source = l.draftRevision ?? l.currentRevision;
      setTitle(source?.title ?? l.title);
      setBody(source?.body ?? "");
      setMinutes(source?.estimatedMinutes ?? "");
      setDeliveryMode(source?.deliveryMode ?? "Recorded");
      setError(null);
      return l;
    }).catch((e) => { setError(e.message); return null; }),
    [session.token, slug, lessonId]);

  useEffect(() => { load(); }, [load]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      onChanged();
      return result;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  function draftPayload(overrides = {}) {
    return {
      title: title.trim(),
      body: body.trim() || null,
      estimatedMinutes: minutes === "" ? null : Number(minutes),
      deliveryMode,
      ...overrides,
    };
  }

  function handleSaveDraft() {
    if (!title.trim()) { setActiveTab("content"); setAttempted(true); return; }
    run(() => api.saveLessonDraft(session.token, slug, lessonId, draftPayload())).then((l) => l && setLesson(l));
  }

  function handlePublish() {
    if (!body.trim()) { setActiveTab("content"); setPublishAttempted(true); return; }
    // Publish always saves first — otherwise it would publish whatever was
    // last saved, silently dropping unsaved edits sitting in the form right now.
    run(async () => {
      await api.saveLessonDraft(session.token, slug, lessonId, draftPayload());
      return api.lessonTransition(session.token, slug, lessonId, "publish");
    }).then((l) => l && setLesson(l));
  }

  /** Lesson Editing & Publication UX, Scenario 3 — no new revision, no republish. */
  function handleQuickSave() {
    if (!title.trim() || !body.trim()) { setAttempted(true); return; }
    run(() => api.quickEditPublishedLesson(session.token, slug, lessonId, {
      title: title.trim(), body: body.trim() || null, estimatedMinutes: minutes === "" ? null : Number(minutes),
    })).then((l) => l && setLesson(l));
  }

  function applyDraftToForm(l) {
    const draft = l.draftRevision;
    setTitle(draft?.title ?? l.title);
    setBody(draft?.body ?? "");
    setMinutes(draft?.estimatedMinutes ?? "");
    setDeliveryMode(draft?.deliveryMode ?? "Recorded");
  }

  /**
   * "Create new version" — a new draft revision of this SAME lesson. Stays
   * on this same editor, lands on Delivery so the new video can be uploaded
   * right away; nothing navigates away. If the dialog was opened from the
   * delivery-type select, the chosen mode is applied to the fresh draft
   * immediately, since a real draft now exists to save it onto.
   */
  async function confirmSameLessonNewVersion() {
    setVersionDialogTrigger(null);
    const started = await run(() => api.startLessonRevision(session.token, slug, lessonId));
    if (!started) return;

    let finalLesson = started;
    if (pendingDeliveryMode && started.draftRevision && started.draftRevision.deliveryMode !== pendingDeliveryMode) {
      const draft = started.draftRevision;
      const updated = await run(() => api.saveLessonDraft(session.token, slug, lessonId, {
        title: draft.title, body: draft.body, estimatedMinutes: draft.estimatedMinutes, deliveryMode: pendingDeliveryMode,
      }));
      if (updated) finalLesson = updated;
    }

    setLesson(finalLesson);
    applyDraftToForm(finalLesson);
    setPendingDeliveryMode(null);
    setActiveTab("delivery");
  }

  /**
   * "Create new draft" — a genuinely separate new Lesson, cloned from this
   * one's current content (no video). This lesson is left exactly as it is;
   * the tutor is redirected to the new lesson's own editor via onDuplicated,
   * which swaps which lesson is open in the parent (CurriculumBuilder keys
   * LessonEditor by lessonId, so that's a clean remount, not a state patch).
   */
  async function confirmDuplicateAsNewLesson() {
    setVersionDialogTrigger(null);
    setPendingDeliveryMode(null);
    const clone = await run(() => api.duplicateLesson(session.token, slug, lessonId));
    if (clone) onDuplicated(clone.id);
  }

  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-studio__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onClose} aria-label="Close"><X size={16} /></button>

        {!lesson && !error && (
          <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> Loading…</div>
        )}
        {error && <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>}

        {lesson && (
          <>
            <div className="lw-eyebrow">Lesson</div>
            <div className="lw-studio__heading">
              <h2 className="lw-studio__panelh2">{title || lesson.title}</h2>
              <span className={`lw-studio__pill is-${lesson.status.toLowerCase()}`}>{human(lesson.status)}</span>
            </div>

            {lesson.currentRevision && (
              <p className="lw-studio__panelnote">
                Published as revision {lesson.currentRevision.version}.{" "}
                {lesson.draftRevision
                  ? "Learners see that content — editing below changes the open draft, not it."
                  : "Title, Content and Estimated minutes below update it directly; replacing the video starts a new revision."}
              </p>
            )}

            <div className="lw-studio__tabs">
              <button type="button" className={activeTab === "content" ? "active" : ""} onClick={() => setActiveTab("content")}>
                <FileText size={13} /> Content
              </button>
              <button type="button" className={activeTab === "delivery" ? "active" : ""} onClick={() => setActiveTab("delivery")}>
                <PlayCircle size={13} /> Delivery
              </button>
              <button type="button" className={activeTab === "questions" ? "active" : ""} onClick={() => setActiveTab("questions")}>
                <Sparkles size={13} /> Interactive Questions
              </button>
            </div>

            {activeTab === "content" && (lesson.draftRevision ? (
              <div className="lw-studio__draftform">
                {attempted && !title.trim() && (
                  <div className="lw-studio__alert"><AlertCircle size={16} /> Title is required.</div>
                )}
                <label>
                  <span>Title<RequiredMark /></span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} required
                         style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
                </label>

                <label>
                  <span>Content<RequiredMark /></span>
                  <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)}
                            placeholder="What this lesson teaches — the material itself for a recorded lesson, or the outline/agenda for a live session."
                            disabled={busy}
                            style={publishAttempted && !body.trim() ? invalidFieldStyle : undefined} />
                </label>
                <label className="lw-studio__minsfield">
                  <span>Estimated minutes</span>
                  <input type="number" min="0" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} disabled={busy} />
                </label>
                <p className="muted" style={{ margin: 0 }}>
                  <strong>Save draft</strong> and <strong>Publish</strong> are below, under the tabs — Save draft keeps
                  changes private while you keep working; Publish makes this version visible to learners right away.
                </p>
                {publishAttempted && !body.trim() && (
                  <div className="lw-studio__alert"><AlertCircle size={16} /> Add some content above before you can publish.</div>
                )}
              </div>
            ) : lesson.currentRevision ? (
              // Lesson Editing & Publication UX, Scenario 3: Title, Content and
              // Estimated minutes are safe to change on the published revision
              // directly — no draft, no republish, just Save changes.
              <div className="lw-studio__draftform">
                {attempted && (!title.trim() || !body.trim()) && (
                  <div className="lw-studio__alert"><AlertCircle size={16} /> Title and content are both required.</div>
                )}
                <label>
                  <span>Title<RequiredMark /></span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} required
                         style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
                </label>
                <label>
                  <span>Content<RequiredMark /></span>
                  <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy}
                            style={attempted && !body.trim() ? invalidFieldStyle : undefined} />
                </label>
                <label className="lw-studio__minsfield">
                  <span>Estimated minutes</span>
                  <input type="number" min="0" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} disabled={busy} />
                </label>
                <p className="muted" style={{ margin: 0 }}>
                  This lesson is published — <strong>Save changes</strong> updates it directly. No new revision, nothing to republish.
                </p>
                <div className="lw-studio__panelactions">
                  <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                          onClick={() => run(() => api.startLessonRevision(session.token, slug, lessonId)).then((l) => l && setLesson(l))}>
                    Start a full new revision instead
                  </button>
                  <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={handleQuickSave}>
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="lw-studio__nodraft">
                <p>This lesson has no content yet.</p>
                <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}
                        onClick={() => run(() => api.startLessonRevision(session.token, slug, lessonId)).then((l) => l && setLesson(l))}>
                  <Plus size={13} /> Start a new revision
                </button>
              </div>
            ))}

            {activeTab === "delivery" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <>
                  <div className="lw-studio__draftform" style={{ marginBottom: 20 }}>
                    <label>
                      <span>Delivery type</span>
                      <select
                        value={deliveryMode} disabled={busy}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (lesson.draftRevision) {
                            setDeliveryMode(next);
                            run(() => api.saveLessonDraft(session.token, slug, lessonId, draftPayload({ deliveryMode: next })))
                              .then((l) => l && setLesson(l));
                          } else {
                            // Lesson Editing & Publication UX, Scenario 5: delivery
                            // mode changes what the lesson fundamentally is, same
                            // as the video — starts a new version instead of
                            // saving in place.
                            setPendingDeliveryMode(next);
                            setVersionDialogTrigger("delivery");
                          }
                        }}
                      >
                        <option value="Recorded">Recorded video</option>
                        <option value="LiveSession">Live session</option>
                      </select>
                    </label>
                  </div>
                  <VideoSection
                    lesson={lesson}
                    hasDraft={!!lesson.draftRevision}
                    deliveryMode={deliveryMode}
                    onChanged={load}
                    onDurationKnown={setVideoDuration}
                    onRequestNewVersion={() => setVersionDialogTrigger("video")}
                  />
                </>
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>
                  Start a revision in Content before setting up delivery.
                </p>
              )
            )}

            {versionDialogTrigger && (
              <ReplaceVersionDialog
                trigger={versionDialogTrigger}
                busy={busy}
                onCancel={() => { setVersionDialogTrigger(null); setPendingDeliveryMode(null); }}
                onChooseNewVersion={confirmSameLessonNewVersion}
                onChooseNewDraft={confirmDuplicateAsNewLesson}
              />
            )}

            {activeTab === "questions" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <AssessmentSection
                  lessonId={lesson.id}
                  videoDurationSeconds={videoDuration}
                />
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>
                  Start a revision in Content before adding interactive questions.
                </p>
              )
            )}

            <div className="lw-studio__panelfooter">
              {lesson.draftRevision && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={handleSaveDraft}>
                  Save draft
                </button>
              )}
              {lesson.draftRevision && lesson.status !== "Archived" && (
                <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={handlePublish}>
                  <Globe size={13} /> Publish
                </button>
              )}
              {lesson.status === "Published" && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                        onClick={() => run(() => api.lessonTransition(session.token, slug, lessonId, "unpublish")).then((l) => l && setLesson(l))}>
                  <Undo2 size={13} /> Unpublish
                </button>
              )}
              {lesson.status !== "Archived" && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                        onClick={() => run(() => api.lessonTransition(session.token, slug, lessonId, "archive")).then((l) => l && setLesson(l))}>
                  <Archive size={13} /> Archive lesson
                </button>
              )}
            </div>

            {lesson.history.length > 1 && (
              <details className="lw-studio__history">
                <summary>Revision history ({lesson.history.length})</summary>
                <ul>
                  {lesson.history.map((r) => (
                    <li key={r.id}>
                      v{r.version} — {r.title}
                      <span className={`lw-studio__pill is-${r.status.toLowerCase()}`}>{human(r.status)}</span>
                      {r.questionCount > 0 && (
                        <span className="lw-studio__historymeta">
                          {r.questionCount} question{r.questionCount === 1 ? "" : "s"}
                          {r.submissionCount > 0 && ` · ${r.submissionCount} submission${r.submissionCount === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Lesson Editing & Publication UX, Scenario 5's "Replace Video Dialog" —
 * shown before replacing the video or changing delivery mode on a published
 * lesson, since both start a new version. Both options here call the same
 * backend action (a new draft, carried forward, video cleared); the
 * difference is purely which tab the tutor lands on afterward.
 */
function ReplaceVersionDialog({ trigger, busy, onCancel, onChooseNewVersion, onChooseNewDraft }) {
  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="lw-studio__panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onCancel} aria-label="Close"><X size={16} /></button>
        <div className="lw-eyebrow">New version</div>
        <h2 className="lw-studio__panelh2">
          {trigger === "video" ? "You're replacing the lesson video" : "You're changing how this lesson is delivered"}
        </h2>
        <p className="lw-studio__panelnote">
          {trigger === "video"
            ? "Replacing the video creates a new learning version. Choose how you'd like to continue."
            : "Changing delivery type creates a new learning version. Choose how you'd like to continue."}
        </p>

        <div className="lw-studio__versionoptions">
          <div className="lw-studio__versionoption">
            <h3>Create new version</h3>
            <ul>
              <li>Copy current lesson</li>
              <li>Upload the new video right away</li>
              <li>Existing students remain on the current version</li>
              <li>New students get the new version once you publish it</li>
            </ul>
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onChooseNewVersion}>
              Create new version
            </button>
          </div>
          <div className="lw-studio__versionoption">
            <h3>Create new draft</h3>
            <ul>
              <li>Creates a separate new lesson, copied from this one</li>
              <li>Video-related assets are not copied</li>
              <li>You're redirected to the new lesson's own editor</li>
              <li>This lesson is left exactly as it is</li>
            </ul>
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onChooseNewDraft}>
              Create new draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Video ─────────────────────────────────────────────────────────────
   Uploads a real file to a real Learning Asset (Learning Asset Aggregate
   Design) — not a data URL. Attaching it to the lesson's draft is what
   makes the lesson "interactive": the assessment below places its
   checkpoints against this video's own timeline.
   ========================================================================= */

function VideoSection({ lesson, hasDraft, deliveryMode, onChanged, onDurationKnown, onRequestNewVersion }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [sourceTab, setSourceTab] = useState("upload");
  const [urlInput, setUrlInput] = useState("");
  const [attachingUrl, setAttachingUrl] = useState(false);

  const revision = lesson.draftRevision ?? lesson.currentRevision;
  const video = revision?.video;
  const videoUrl = revision?.videoUrl;
  const hasVideo = !!video || !!videoUrl;

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const asset = await api.uploadLearningAsset(session.token, slug, file, file.name, setProgress);
      await api.attachLessonVideo(session.token, slug, lesson.id, asset.id);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAttachUrl() {
    if (!urlInput.trim()) return;
    setAttachingUrl(true);
    setError(null);
    try {
      await api.setLessonVideoUrl(session.token, slug, lesson.id, urlInput.trim());
      setUrlInput("");
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setAttachingUrl(false);
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await api.removeLessonVideo(session.token, slug, lesson.id);
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  const isLive = deliveryMode === "LiveSession";

  return (
    <div className="lw-studio__section">
      <h2 className="lw-sectiontitle">{isLive ? "Recording" : "Video"}</h2>
      {isLive && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>
          This lesson is a live session — the content above is what learners see before joining.
          Add a recording afterward if you want one on file.
        </p>
      )}
      {error && <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>}

      {!hasVideo && hasDraft && (
        <>
          <div className="lw-segctrl" style={{ marginBottom: 14 }}>
            <button type="button" className={sourceTab === "upload" ? "active" : ""} onClick={() => setSourceTab("upload")}>
              <UploadCloud size={13} /> Upload
            </button>
            <button type="button" className={sourceTab === "url" ? "active" : ""} onClick={() => setSourceTab("url")}>
              <LinkIcon size={13} /> URL
            </button>
          </div>

          {sourceTab === "upload" ? (
            uploading ? (
              <div className="lw-dropzone lw-dropzone--compact">
                <LoaderCircle size={24} className="lw-studio__spin" />
                <span className="lw-dropzone__title">Uploading… {Math.round(progress * 100)}%</span>
              </div>
            ) : (
              <div className="lw-dropzone" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
                <UploadCloud size={26} />
                <span className="lw-dropzone__title">{isLive ? "Upload a recording (optional)" : "Upload a lesson video"}</span>
                <span className="lw-dropzone__meta">
                  {isLive
                    ? "If you recorded this session, add it here — learners can rewatch it."
                    : "This becomes the interactive video learners watch — checkpoints get placed on its timeline below."}
                </span>
                <input
                  ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            )
          ) : (
            <div className="lw-studio__draftform">
              <label>
                <span>Video URL</span>
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                       placeholder="https://example.com/video.mp4" disabled={attachingUrl} />
              </label>
              <div className="lw-studio__panelactions">
                <button type="button" className="lw-btn lw-btn--accent lw-btn--sm"
                        disabled={attachingUrl || !urlInput.trim()} onClick={handleAttachUrl}>
                  {attachingUrl ? <LoaderCircle size={13} className="lw-studio__spin" /> : <LinkIcon size={13} />} Attach
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!hasVideo && !hasDraft && (
        <div className="lw-studio__unitempty" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>No video yet. Adding one starts a new version of this lesson.</span>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
            <UploadCloud size={13} /> Add a video
          </button>
        </div>
      )}

      {video && (
        <div className="lw-player">
          <div className="lw-player__frame">
            <video
              key={video.id}
              src={api.learningAssetDownloadUrl(session.token, slug, video.id)}
              controls
              style={{ width: "100%", height: "100%" }}
              onLoadedMetadata={(e) => onDurationKnown(Math.round(e.target.duration))}
            />
          </div>
          <div className="lw-videosource" style={{ padding: "12px 16px", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {video.title} <span className="lw-tag lw-tag--source">{Math.round(video.fileSizeBytes / 1024 / 1024)} MB</span>
            </span>
            {hasDraft ? (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={handleRemove}>
                <Trash2 size={13} /> Remove
              </button>
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
                <UploadCloud size={13} /> Replace video
              </button>
            )}
          </div>
        </div>
      )}

      {videoUrl && (
        <div className="lw-player">
          <div className="lw-player__frame">
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              style={{ width: "100%", height: "100%" }}
              onLoadedMetadata={(e) => onDurationKnown(Math.round(e.target.duration))}
            />
          </div>
          <div className="lw-videosource" style={{ padding: "12px 16px", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <span className="lw-tag lw-tag--source" style={{ wordBreak: "break-all" }}>{videoUrl}</span>
            {hasDraft ? (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={handleRemove}>
                <Trash2 size={13} /> Remove
              </button>
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
                <UploadCloud size={13} /> Replace video
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Interactive assessment ────────────────────────────────────────────
   AI Interactive Video Lesson Generator: AI proposes timestamped checkpoints
   (simulated — templated, per App.jsx's PSEUDO-AI HELPERS remark) for the
   tutor to Accept / Remove (§7), and grades a preview attempt against the
   real answer key the tutor authored (Assessment and Submission Aggregate
   Design §10, "AI Evaluation").
   ========================================================================= */

const ANALYZE_STEPS = ["Watching the video…", "Detecting explanations and examples…", "Placing knowledge checkpoints…"];

function AssessmentSection({ lessonId, videoDurationSeconds }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [suggestions, setSuggestions] = useState([]);

  const [formMode, setFormMode] = useState(null); // null | "new" | Question being edited
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(
    () => api.getAssessment(session.token, slug, lessonId)
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; }),
    [session.token, slug, lessonId]);

  useEffect(() => { load(); }, [load]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { return await fn(); }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function handleAiSuggest() {
    if (!videoDurationSeconds) return;
    setSuggesting(true);
    setError(null);
    for (let i = 0; i < ANALYZE_STEPS.length; i++) {
      setAnalyzeStep(i);
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
    try {
      const result = await api.suggestQuestions(session.token, slug, lessonId, videoDurationSeconds);
      setSuggestions(result.map((s, i) => ({ ...s, key: `suggestion-${Date.now()}-${i}` })));
    } catch (e) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(s) {
    const result = await run(() => api.addQuestion(session.token, slug, lessonId, {
      type: s.type, prompt: s.prompt, options: s.options, correctOptionIndex: s.correctOptionIndex,
      acceptedAnswers: s.acceptedAnswers, explanation: s.explanation,
      videoTimestampSeconds: s.videoTimestampSeconds, points: s.points,
    }));
    if (result) {
      setData(result);
      setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    }
  }

  function rejectSuggestion(key) {
    setSuggestions((prev) => prev.filter((x) => x.key !== key));
  }

  async function saveQuestion(body) {
    const result = formMode === "new"
      ? await run(() => api.addQuestion(session.token, slug, lessonId, body))
      : await run(() => api.updateQuestion(session.token, slug, lessonId, formMode.id, body));
    if (result) { setData(result); setFormMode(null); }
  }

  async function removeQuestion(questionId) {
    const result = await run(() => api.removeQuestion(session.token, slug, lessonId, questionId));
    if (result) setData(result);
  }

  if (!data) {
    return (
      <div className="lw-studio__section">
        <h2 className="lw-sectiontitle">Interactive questions</h2>
        <div className="lw-studio__loading"><LoaderCircle size={16} className="lw-studio__spin" /> Loading…</div>
      </div>
    );
  }

  // Lesson Editing & Publication UX, Scenario 4: interactive questions are
  // always editable for an author, whether this Assessment is Draft or
  // Published — Publish/Unpublish below stay purely about learner visibility.
  const editable = true;

  return (
    <div className="lw-studio__section">
      <div className="lw-studio__heading">
        <h2 className="lw-sectiontitle" style={{ margin: 0 }}>Interactive questions</h2>
        <span className={`lw-studio__pill is-${data.status.toLowerCase()}`}>{human(data.status)}</span>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Multiple choice, true/false, complete-the-sentence or open questions, placed on the video's
        timeline. AI grades every attempt instantly — open questions are reviewed, not scored.
      </p>

      {error && <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>}

      {editable && (
        <div className="lw-studio__bar">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy || suggesting || !videoDurationSeconds}
                  onClick={handleAiSuggest} title={!videoDurationSeconds ? "Upload a video first" : undefined}>
            <Sparkles size={13} /> Ask AI to suggest checkpoints
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setFormMode("new")}>
            <Plus size={13} /> Add question
          </button>
          {data.questions.length > 0 && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setPreviewOpen(true)}>
              <Bot size={13} /> Preview AI grading
            </button>
          )}
          {data.status === "Published" ? (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                    onClick={() => run(() => api.assessmentTransition(session.token, slug, lessonId, "unpublish")).then((r) => r && setData(r))}>
              <Undo2 size={13} /> Unpublish
            </button>
          ) : (
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!data.publicationBlocker}
                    onClick={() => run(() => api.assessmentTransition(session.token, slug, lessonId, "publish")).then((r) => r && setData(r))}>
              <Globe size={13} /> Publish questions
            </button>
          )}
        </div>
      )}

      {data.publicationBlocker && (
        <div className="lw-studio__blocker"><AlertCircle size={14} /> {data.publicationBlocker}</div>
      )}

      {suggesting && (
        <div className="lw-analyzing">
          <div className="lw-spinner" />
          <ul className="lw-analyzing__steps">
            {ANALYZE_STEPS.map((step, i) => (
              <li key={step} className={i < analyzeStep ? "done" : i === analyzeStep ? "active" : ""}>
                {i < analyzeStep ? <Check size={13} /> : <LoaderCircle size={13} className={i === analyzeStep ? "lw-studio__spin" : ""} />}
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="lw-studio__units" style={{ marginTop: 14 }}>
          {suggestions.map((s) => (
            <SuggestionRow key={s.key} s={s} busy={busy} onAccept={acceptSuggestion} onReject={rejectSuggestion} />
          ))}
        </div>
      )}

      {formMode && (
        <QuestionForm
          initial={formMode === "new" ? null : formMode}
          busy={busy}
          onSave={saveQuestion}
          onCancel={() => setFormMode(null)}
        />
      )}

      {data.questions.length === 0 && suggestions.length === 0 && !formMode && (
        <div className="lw-empty">
          {editable ? "No questions yet — ask AI to suggest some, or add one by hand." : "This lesson has no interactive questions."}
        </div>
      )}

      {data.questions.length > 0 && (
        <div className="lw-studio__units" style={{ marginTop: 14 }}>
          {data.questions.map((q) => (
            <QuestionRow key={q.id} q={q} editable={editable} onEdit={setFormMode} onRemove={removeQuestion} />
          ))}
        </div>
      )}

      {previewOpen && (
        <PreviewPanel
          questions={data.questions}
          onClose={() => setPreviewOpen(false)}
          onSubmit={(answers) => api.previewAssessment(session.token, slug, lessonId, answers)}
        />
      )}
    </div>
  );
}

/**
 * The QuestionType enum's values + display labels (backend/src/Platform.Domain/AssessmentEnums.cs),
 * fetched once from GET /reference/question-types and cached module-wide so no
 * frontend layer hard-codes the type names or their labels.
 */
let questionTypesCache = null;
let questionTypesInflight = null;

function useQuestionTypes() {
  const { session } = useAuth();
  const [types, setTypes] = useState(questionTypesCache ?? []);
  useEffect(() => {
    if (questionTypesCache) return;
    questionTypesInflight ??= api.getQuestionTypes(session.token);
    questionTypesInflight.then((data) => { questionTypesCache = data; setTypes(data); }).catch(() => {});
  }, [session.token]);
  return types;
}

const typeLabel = (types, value) => types.find((t) => t.value === value)?.label ?? value;

/** Renders a question's answer key the way its type calls for — options, accepted phrasings, or nothing at all. */
function AnswerKeyDisplay({ type, options, correctOptionIndex, acceptedAnswers }) {
  if (type === "CompleteTheSentence") {
    return (
      <div className="discover-tag-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {acceptedAnswers.map((a, i) => (
          <span key={i} className="lw-tag" style={{ background: "var(--surface-2)" }}>{a}</span>
        ))}
      </div>
    );
  }
  if (type === "OpenAnswer") {
    return <p className="muted" style={{ margin: 0, fontStyle: "italic" }}>Reviewed for participation, not auto-scored.</p>;
  }
  return (
    <div className="lw-options">
      {options.map((opt, i) => (
        <div key={i} className={`lw-option ${i === correctOptionIndex ? "is-correct" : ""}`} style={{ cursor: "default" }}>
          {opt}
        </div>
      ))}
    </div>
  );
}

function SuggestionRow({ s, onAccept, onReject, busy }) {
  const types = useQuestionTypes();
  return (
    <div className="lw-studio__unit">
      <p className="lw-questioncard__prompt" style={{ fontSize: "0.92rem", margin: "0 0 10px" }}>
        <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, s.type)}</span>
        {s.videoTimestampSeconds != null && <span className="lw-timestamp lw-tag" style={{ marginRight: 8 }}>{formatTime(s.videoTimestampSeconds)}</span>}
        {s.prompt}
      </p>
      <AnswerKeyDisplay type={s.type} options={s.options} correctOptionIndex={s.correctOptionIndex} acceptedAnswers={s.acceptedAnswers} />
      {s.explanation && <p className="lw-rationale"><Sparkles size={12} /> {s.explanation}</p>}
      <div className="lw-rowactions" style={{ marginTop: 12 }}>
        <button className="active" disabled={busy} aria-label="Accept" onClick={() => onAccept(s)}><Check size={13} /></button>
        <button className="active danger" disabled={busy} aria-label="Remove suggestion" onClick={() => onReject(s.key)}><X size={13} /></button>
      </div>
    </div>
  );
}

function QuestionRow({ q, editable, onEdit, onRemove }) {
  const types = useQuestionTypes();
  return (
    <div className="lw-studio__unit">
      <p className="lw-questioncard__prompt" style={{ fontSize: "0.92rem", margin: "0 0 10px" }}>
        <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, q.type)}</span>
        {q.videoTimestampSeconds != null && <span className="lw-timestamp lw-tag" style={{ marginRight: 8 }}>{formatTime(q.videoTimestampSeconds)}</span>}
        {q.prompt}
      </p>
      <AnswerKeyDisplay type={q.type} options={q.options} correctOptionIndex={q.correctOptionIndex} acceptedAnswers={q.acceptedAnswers} />
      {q.explanation && <p className="lw-rationale"><Sparkles size={12} /> {q.explanation}</p>}
      {editable && (
        <div className="lw-rowactions" style={{ marginTop: 12 }}>
          <button aria-label="Edit question" onClick={() => onEdit(q)}><Pencil size={13} /></button>
          <button aria-label="Remove question" onClick={() => onRemove(q.id)}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  );
}

function QuestionForm({ initial, busy, onSave, onCancel }) {
  const types = useQuestionTypes();
  const [type, setType] = useState(initial?.type ?? types[0]?.value ?? "MultipleChoice");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState(initial?.type === "MultipleChoice" && initial.options.length ? initial.options : ["", ""]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(initial?.correctOptionIndex ?? 0);
  const [acceptedAnswers, setAcceptedAnswers] = useState(
    initial?.type === "CompleteTheSentence" && initial.acceptedAnswers.length ? initial.acceptedAnswers : [""]);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [timestamp, setTimestamp] = useState(initial?.videoTimestampSeconds ?? "");
  const [points, setPoints] = useState(initial?.points ?? 1);
  const [attempted, setAttempted] = useState(false);

  function selectType(next) {
    setType(next);
    if (next === "MultipleChoice" && options.filter((o) => o.trim()).length < 2) setOptions(["", ""]);
    if (next === "TrueFalse" && correctOptionIndex !== 0 && correctOptionIndex !== 1) setCorrectOptionIndex(0);
    if (next === "CompleteTheSentence" && acceptedAnswers.length === 0) setAcceptedAnswers([""]);
  }

  const updateOption = (i, value) => setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (i) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    setCorrectOptionIndex((prev) => (prev >= i ? Math.max(0, prev - 1) : prev));
  };

  const updateAcceptedAnswer = (i, value) => setAcceptedAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  const addAcceptedAnswer = () => setAcceptedAnswers((prev) => [...prev, ""]);
  const removeAcceptedAnswer = (i) => setAcceptedAnswers((prev) => prev.filter((_, idx) => idx !== i));

  const validationMessages = [
    !prompt.trim() && "Enter the question text.",
    type === "MultipleChoice" && options.filter((o) => o.trim()).length < 2 && "Add at least 2 options.",
    type === "CompleteTheSentence" && !acceptedAnswers.some((a) => a.trim()) && "Add at least one accepted answer.",
  ].filter(Boolean);
  const valid = validationMessages.length === 0;

  return (
    <form
      className="lw-studio__draftform" style={{ marginTop: 14 }} noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) { setAttempted(true); return; }
        onSave({
          type,
          prompt: prompt.trim(),
          options: type === "MultipleChoice" ? options.map((o) => o.trim()).filter(Boolean)
                  : type === "TrueFalse" ? ["True", "False"] : [],
          correctOptionIndex: (type === "MultipleChoice" || type === "TrueFalse") ? correctOptionIndex : null,
          acceptedAnswers: type === "CompleteTheSentence" ? acceptedAnswers.map((a) => a.trim()).filter(Boolean) : [],
          explanation: explanation.trim() || null,
          videoTimestampSeconds: timestamp === "" ? null : Number(timestamp),
          points: Number(points) || 1,
        });
      }}
    >
      {attempted && validationMessages.length > 0 && (
        <div className="lw-studio__alert">
          <AlertCircle size={16} />
          {validationMessages.length === 1 ? validationMessages[0] : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {validationMessages.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <label>
        <span>Type</span>
        <div className="lw-segctrl" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {types.map((t) => (
            <button key={t.value} type="button" className={type === t.value ? "active" : ""} disabled={busy} onClick={() => selectType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </label>

      <label>
        <span>Question<RequiredMark /></span>
        <textarea rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} required
                   style={attempted && !prompt.trim() ? invalidFieldStyle : undefined} />
      </label>

      {type === "MultipleChoice" && (
        <>
          <div className="lw-options">
            {options.map((opt, i) => (
              <div key={i} className="lw-option" style={{ cursor: "default" }}>
                <input type="radio" name="correct-option" checked={correctOptionIndex === i}
                       onChange={() => setCorrectOptionIndex(i)} disabled={busy} />
                <input
                  style={{ flex: 1, border: 0, background: "transparent", font: "inherit", color: "inherit", outline: "none", margin: "0 8px" }}
                  value={opt} onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`} disabled={busy}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} aria-label="Remove option" style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink-soft)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={addOption} disabled={busy} style={{ width: "fit-content" }}>
            <Plus size={12} /> Add option
          </button>
        </>
      )}

      {type === "TrueFalse" && (
        <div className="lw-options">
          {["True", "False"].map((label, i) => (
            <div key={label} className="lw-option" style={{ cursor: "default" }}>
              <input type="radio" name="correct-option" checked={correctOptionIndex === i}
                     onChange={() => setCorrectOptionIndex(i)} disabled={busy} />
              <span style={{ marginLeft: 8 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {type === "CompleteTheSentence" && (
        <>
          <p className="muted" style={{ margin: "0 0 4px" }}>Any one of these phrasings counts as correct.</p>
          <div className="lw-options">
            {acceptedAnswers.map((a, i) => (
              <div key={i} className="lw-option" style={{ cursor: "default" }}>
                <input
                  style={{ flex: 1, border: 0, background: "transparent", font: "inherit", color: "inherit", outline: "none" }}
                  value={a} onChange={(e) => updateAcceptedAnswer(i, e.target.value)}
                  placeholder={`Accepted answer ${i + 1}`} disabled={busy}
                />
                {acceptedAnswers.length > 1 && (
                  <button type="button" onClick={() => removeAcceptedAnswer(i)} aria-label="Remove accepted answer" style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink-soft)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={addAcceptedAnswer} disabled={busy} style={{ width: "fit-content" }}>
            <Plus size={12} /> Add accepted phrasing
          </button>
        </>
      )}

      {type === "OpenAnswer" && (
        <p className="muted" style={{ margin: 0 }}>
          No answer key — a learner's response is reviewed for participation, not auto-scored.
          Use the field below for guidance on what a good answer covers.
        </p>
      )}

      <label>
        <span>{type === "OpenAnswer" ? "Guidance " : "Explanation "}<em>(shown after answering)</em></span>
        <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} disabled={busy} />
      </label>

      <div className="lw-studio__minsfield">
        <span>Video timestamp <em>(seconds)</em></span>
        <input type="number" min="0" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} disabled={busy} />
      </div>
      <div className="lw-studio__minsfield">
        <span>Points</span>
        <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} disabled={busy} />
      </div>

      <div className="lw-studio__panelactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
          <Check size={13} /> Save question
        </button>
      </div>
    </form>
  );
}

function PreviewPanel({ questions, onClose, onSubmit }) {
  const types = useQuestionTypes();
  const [answers, setAnswers] = useState({});
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const isAnswered = (q) => {
    const a = answers[q.id];
    if (!a) return false;
    return (q.type === "MultipleChoice" || q.type === "TrueFalse") ? a.selectedOptionIndex != null : !!a.textAnswer?.trim();
  };

  async function handleSubmit() {
    setGrading(true);
    setError(null);
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: answers[q.id]?.selectedOptionIndex ?? null,
        textAnswer: answers[q.id]?.textAnswer ?? null,
      }));
      setResult(await onSubmit(payload));
    } catch (e) {
      setError(e.message);
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-studio__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="lw-eyebrow">Preview · Simulated AI grading</div>
        <h2 className="lw-studio__panelh2">Take the questions as a learner would</h2>

        {error && <div className="lw-studio__alert"><AlertCircle size={16} /> {error}</div>}

        {!result && questions.map((q) => (
          <div key={q.id} style={{ marginTop: 18 }}>
            <p className="lw-questioncard__prompt" style={{ fontSize: "0.9rem", margin: "0 0 10px" }}>
              <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, q.type)}</span>
              {q.prompt}
            </p>
            {(q.type === "MultipleChoice" || q.type === "TrueFalse") ? (
              <div className="lw-options">
                {q.options.map((opt, i) => (
                  <button
                    type="button" key={i}
                    className={`lw-option ${answers[q.id]?.selectedOptionIndex === i ? "is-selected" : ""}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: { selectedOptionIndex: i } }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="studio-text-input" style={{ width: "100%" }}
                value={answers[q.id]?.textAnswer ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: { textAnswer: e.target.value } }))}
                placeholder={q.type === "CompleteTheSentence" ? "Your answer…" : "Your response…"}
              />
            )}
          </div>
        ))}

        {!result && (
          <div className="lw-studio__panelactions" style={{ marginTop: 20 }}>
            <button
              className="lw-btn lw-btn--accent lw-btn--sm"
              disabled={grading || !questions.every(isAnswered)}
              onClick={handleSubmit}
            >
              {grading
                ? <><LoaderCircle size={13} className="lw-studio__spin" /> AI is grading…</>
                : <><Bot size={13} /> Submit for AI grading</>}
            </button>
          </div>
        )}

        {result && (
          <div className="lw-aicard" style={{ marginTop: 18, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Bot size={16} />
              <div className="lw-aicard__body">
                <strong>{result.passed ? "Passed" : "Not yet passing"} — {result.scorePercent}%</strong>
                <p style={{ margin: "4px 0 0" }}>{result.aiFeedback}</p>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {questions.map((q) => {
                const pq = result.perQuestion.find((p) => p.questionId === q.id);
                const reviewed = pq?.correct == null;
                return (
                  <div key={q.id} className="lw-feedback" style={{ margin: 0 }}>
                    {reviewed ? <Sparkles size={14} /> : pq?.correct ? <Check size={14} /> : <X size={14} />}
                    <span>
                      {q.prompt}{" "}
                      {reviewed ? "— reviewed, not scored" : pq?.correct ? "— correct" : `— correct answer: ${pq?.correctAnswerDisplay ?? "n/a"}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
  .muted { color: var(--ink-soft); font-size: 0.86rem; line-height: 1.55; }
  .lw-studio__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-studio__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm);
    padding: 10px 13px; margin-bottom: 16px; font-size: 0.87rem;
  }
  .lw-studio__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 0; margin-bottom: 14px;
  }
  .lw-studio__back:hover { color: var(--ink); }

  /* UIC-004: the title (h1/h2) and its status pill center as one row. */
  .lw-studio__heading { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
  .lw-studio__heading h1, .lw-studio__panelh2 { margin: 2px 0 6px; text-align: center; }

  .lw-studio__pill {
    font-family: var(--font-mono); font-size: 10px; border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink-soft); white-space: nowrap;
  }
  .lw-studio__pill.is-published { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-studio__pill.is-draftopen { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
  .lw-studio__pill.is-none { background: var(--surface-2); color: var(--ink-soft); }

  .lw-studio__bar { display: flex; gap: 8px; margin: 4px 0 14px; }
  .lw-studio__blocker {
    display: flex; align-items: flex-start; gap: 8px; font-size: 0.83rem; color: var(--ink-soft);
    background: var(--surface-2); border-radius: var(--radius-sm); padding: 11px 14px; margin-bottom: 16px; max-width: 66ch; line-height: 1.5;
  }
  .lw-studio__blocker svg { flex-shrink: 0; margin-top: 1px; color: var(--accent); }

  .lw-studio__empty {
    text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 34px 26px; margin-bottom: 18px;
  }
  .lw-studio__empty h2 { font-family: var(--font-display); font-size: 1.05rem; color: var(--ink); margin: 10px 0 6px; }
  .lw-studio__empty p { font-size: 0.86rem; max-width: 46ch; margin: 0 auto; line-height: 1.6; }
  .lw-studio__steps {
    list-style: none; counter-reset: lw-step; text-align: left;
    max-width: 44ch; margin: 4px auto 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
  }
  .lw-studio__steps li {
    counter-increment: lw-step; position: relative; padding-left: 30px;
    font-size: 0.86rem; color: var(--ink-soft); line-height: 1.5;
  }
  .lw-studio__steps li::before {
    content: counter(lw-step); position: absolute; left: 0; top: -1px;
    width: 20px; height: 20px; border-radius: 50%; background: var(--surface-2); color: var(--ink);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-size: 10.5px; flex-shrink: 0;
  }
  .lw-studio__steps li strong { color: var(--ink); }

  .lw-studio__newunit { display: flex; gap: 8px; margin-bottom: 18px; }
  .lw-studio__newunit input {
    flex: 1; font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 12px;
  }

  .lw-studio__units { display: flex; flex-direction: column; gap: 14px; }
  .lw-studio__unit {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 16px 18px;
  }
  .lw-studio__unithead { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .lw-studio__unittitle { display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; flex: 1; }
  .lw-studio__unitnum {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    background: var(--surface-2); color: var(--ink-soft);
    display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px;
  }
  .lw-studio__unitactions { display: flex; gap: 4px; }
  .lw-studio__unitactions button {
    background: transparent; border: 1px solid var(--line); border-radius: 6px;
    color: var(--ink-soft); cursor: pointer; padding: 5px; display: flex;
  }
  .lw-studio__unitactions button:hover { color: var(--ink); }
  .lw-studio__renameform { display: flex; gap: 6px; align-items: center; flex: 1; }
  .lw-studio__renameform input {
    flex: 1; font-family: var(--font-display); font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--accent); border-radius: 6px; padding: 5px 9px; background: var(--bg); color: var(--ink);
  }
  .lw-studio__renameform button { background: transparent; border: none; color: var(--accent); cursor: pointer; display: flex; }

  .lw-studio__unitempty { font-size: 0.82rem; color: var(--ink-soft); font-style: italic; padding: 6px 0 10px; }

  .lw-studio__lessonlist { display: flex; flex-direction: column; gap: 6px; }
  .lw-studio__lessonrow { display: flex; align-items: center; gap: 4px; }
  .lw-studio__lessonopen {
    flex: 1; display: flex; align-items: center; gap: 9px; text-align: left;
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 9px 12px; cursor: pointer; font-family: var(--font-body); color: var(--ink);
  }
  .lw-studio__lessonopen:hover { border-color: var(--accent); }
  .lw-studio__lessonopen svg:first-child { color: var(--ink-soft); flex-shrink: 0; }
  .lw-studio__lessontitle { flex: 1; font-size: 0.87rem; font-weight: 500; }
  .lw-studio__mins { font-family: var(--font-mono); font-size: 10px; color: var(--ink-soft); }
  .lw-studio__lessonremove {
    background: transparent; border: 1px solid var(--line); border-radius: var(--radius-sm);
    color: var(--ink-soft); cursor: pointer; padding: 9px; display: flex; flex-shrink: 0;
  }
  .lw-studio__lessonremove:hover { color: var(--danger); border-color: var(--danger); }

  .lw-studio__addlesson { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .lw-studio__addlesson form { display: flex; gap: 6px; flex: 1; min-width: 220px; }
  .lw-studio__addlesson input, .lw-studio__addlesson select {
    font-family: var(--font-body); font-size: 0.83rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 7px 10px;
  }
  .lw-studio__addlesson input { flex: 1; }

  .lw-studio__readonly { font-size: 0.83rem; color: var(--ink-soft); margin-top: 18px; font-style: italic; }

  .lw-studio__cardgrid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px;
  }
  .lw-studio__card {
    display: flex; flex-direction: column; text-align: left; cursor: pointer; padding: 0;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    overflow: hidden; font-family: var(--font-body);
  }
  .lw-studio__card:hover { border-color: var(--accent); }
  .lw-studio__cardcover {
    height: 92px; position: relative; display: flex; align-items: center; justify-content: center;
  }
  .lw-studio__cardmonogram {
    font-family: var(--font-display); font-size: 2rem; font-weight: 600; color: rgba(255,255,255,0.92);
  }
  .lw-studio__cardcover .lw-studio__pill {
    position: absolute; top: 9px; right: 9px; background: rgba(10,12,15,0.4); color: #fff;
  }
  .lw-cover--0 { background: linear-gradient(135deg, #2D5BD1, #6D3FC4); }
  .lw-cover--1 { background: linear-gradient(135deg, #1E7F63, #5B8DEF); }
  .lw-cover--2 { background: linear-gradient(135deg, #E0A83E, #C4533F); }
  .lw-cover--3 { background: linear-gradient(135deg, #0EA5A5, #6D3FC4); }
  .lw-cover--4 { background: linear-gradient(135deg, #D1477A, #E0A83E); }
  .lw-studio__cardbody { padding: 11px 13px 13px; display: flex; flex-direction: column; gap: 7px; }
  .lw-studio__cardtitle { font-weight: 600; font-size: 0.92rem; color: var(--ink); }
  .lw-studio__pickhas { display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; color: var(--accent-2); }
  .lw-studio__picknone { font-size: 0.78rem; color: var(--ink-soft); font-style: italic; }

  .lw-studio__overlay {
    position: fixed; inset: 0; background: rgba(10,12,15,0.55);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 40px 20px; z-index: 50; overflow-y: auto;
  }
  .lw-studio__panel {
    background: var(--surface); color: var(--ink); border-radius: var(--radius);
    max-width: 640px; width: 100%; padding: 30px 32px 34px; position: relative;
  }
  .lw-studio__panelclose { position: absolute; top: 18px; right: 18px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
  .lw-studio__panelclose:hover { color: var(--ink); }
  .lw-studio__panelnote { font-size: 0.83rem; color: var(--ink-soft); margin: 0 0 16px; line-height: 1.5; }

  /* UIC-003: one property per row — label left, value right — in a shared
     grid per form. Multi-part editors (option lists, alerts, action rows)
     are direct children too, so they get grid-column: 1 / -1 to span both
     columns instead of being squeezed into the label/value layout. */
  .lw-studio__draftform { display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start; }
  .lw-studio__draftform > label, .lw-studio__draftform > .lw-studio__minsfield { display: contents; }
  .lw-studio__draftform label > span:first-child,
  .lw-studio__draftform > .lw-studio__minsfield > span:first-child {
    font-size: 0.78rem; font-weight: 600; padding-top: 9px; white-space: nowrap;
  }
  .lw-studio__draftform em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .lw-studio__draftform input, .lw-studio__draftform textarea, .lw-studio__draftform select {
    font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 9px 11px; resize: vertical;
  }
  .lw-studio__draftform > .lw-studio__alert,
  .lw-studio__draftform > p,
  .lw-studio__draftform > .lw-options,
  .lw-studio__draftform > button,
  .lw-studio__draftform > .lw-studio__panelactions {
    grid-column: 1 / -1;
  }
  .lw-studio__minsfield input { max-width: 120px; }
  .lw-studio__panelactions { display: flex; justify-content: flex-end; gap: 8px; }
  .lw-studio__fielderror { display: block; color: #C0392B; font-size: 0.78rem; margin-top: 4px; }
  @media (max-width: 560px) {
    .lw-studio__draftform { grid-template-columns: 1fr; }
    .lw-studio__draftform > label, .lw-studio__draftform > .lw-studio__minsfield { display: flex; flex-direction: column; gap: 5px; }
    .lw-studio__draftform label > span:first-child,
    .lw-studio__draftform > .lw-studio__minsfield > span:first-child { padding-top: 0; white-space: normal; }
  }

  .lw-studio__nodraft {
    background: var(--surface-2); border-radius: var(--radius-sm);
    padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start;
  }
  .lw-studio__nodraft p { font-size: 0.86rem; color: var(--ink-soft); margin: 0; line-height: 1.5; }

  .lw-studio__versionoptions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
  .lw-studio__versionoption {
    display: flex; flex-direction: column; gap: 10px;
    background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px 16px;
  }
  .lw-studio__versionoption h3 { font-size: 0.88rem; margin: 0; }
  .lw-studio__versionoption ul { margin: 0; padding-left: 18px; font-size: 0.78rem; color: var(--ink-soft); line-height: 1.6; flex: 1; }
  .lw-studio__versionoption button { width: 100%; justify-content: center; }
  @media (max-width: 480px) { .lw-studio__versionoptions { grid-template-columns: 1fr; } }

  .lw-studio__panelfooter { display: flex; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }

  .lw-studio__history { margin-top: 16px; font-size: 0.82rem; color: var(--ink-soft); }
  .lw-studio__history summary { cursor: pointer; font-weight: 600; }
  .lw-studio__history ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .lw-studio__history li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  /* Proof that superseding a revision keeps its questions and graded
     submissions — not just the content itself (Assessment.cs remarks). */
  .lw-studio__historymeta { font-size: 0.76rem; color: var(--ink-soft); }

  .lw-studio__spin { animation: lwStudioSpin 0.9s linear infinite; }
  @keyframes lwStudioSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-studio__spin { animation: none; } }
  @media (max-width: 640px) { .lw-studio__addlesson form { min-width: 0; } }

  .lw-studio__section { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line); }
  .lw-option.is-selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }

  /* A darker track behind the pills is what makes this read as tabs to switch
     between, rather than a row of independent buttons like .lw-segctrl's
     other uses (a value picker sitting under a single label). */
  .lw-studio__tabs {
    display: flex; gap: 4px; flex-wrap: wrap;
    background: var(--surface-2); padding: 4px; border-radius: 10px;
    width: fit-content; margin: 14px 0 20px;
  }
  .lw-studio__tabs button {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 7px; border: none; background: transparent;
    color: var(--ink-soft); font-family: var(--font-body); font-size: 0.85rem; cursor: pointer;
    transition: background .12s, color .12s;
  }
  .lw-studio__tabs button:hover:not(.active) { color: var(--ink); }
  .lw-studio__tabs button.active {
    background: var(--surface); color: var(--ink); font-weight: 600;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  }
`;
