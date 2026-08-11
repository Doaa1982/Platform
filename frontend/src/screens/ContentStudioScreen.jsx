import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, ArrowLeft, X, Trash2,
  Globe, Undo2, Archive, Layers, FileText, Pencil, Check, BookOpen,
  UploadCloud, Sparkles, Bot, PlayCircle, Link as LinkIcon, ChevronUp, ChevronDown,
  ClipboardCheck, Paperclip, Download,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";
import Message from "../components/Message";
import { useLanguage } from "../i18n/useLanguage";

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

const STATUS_KEY = { Draft: "products.statusDraft", UnderReview: "products.statusUnderReview", Published: "products.statusPublished", Archived: "products.statusArchived", Closed: "products.statusClosed" };
const human = (t, s) => (t(STATUS_KEY[s] ?? "") || s || "");

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
  const { t } = useLanguage();
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
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> {t("studio.loading")}</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">{t("studio.eyebrow")}</div>
      <h1>{t("studio.pickTitle")}</h1>
      <p className="lw-sub">{t("studio.pickLead")}</p>

      {data.products.length === 0 && (
        <div className="lw-studio__empty">
          <BookOpen size={26} />
          <h2>{t("studio.noProductsTitle")}</h2>
          <p>{t("studio.noProductsBody")}</p>
        </div>
      )}

      <div className="lw-studio__cardgrid">
        {data.products.map((p) => (
          <button className="lw-studio__card" key={p.id} onClick={() => onSelect(p.id)}>
            <div className={`lw-studio__cardcover lw-cover--${coverVariant(p.id)}`}>
              <span className="lw-studio__cardmonogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
              <span className={`lw-studio__pill is-${p.status.toLowerCase()}`}>{human(t, p.status)}</span>
            </div>
            <div className="lw-studio__cardbody">
              <div className="lw-studio__cardtitle">{p.title}</div>
              {p.hasCurriculum
                ? <span className="lw-studio__pickhas"><Layers size={11} /> {t("studio.hasCurriculum")}</span>
                : <span className="lw-studio__picknone">{t("studio.nothingBuilt")}</span>}
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
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  function moveUnit(unitId, direction) {
    if (!data) return;
    const ids = data.units.map((u) => u.id);
    const i = ids.indexOf(unitId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.reorderUnits(session.token, slug, productId, ids)).then(load);
  }

  function moveLesson(unitId, lessonId, direction) {
    if (!data) return;
    const unit = data.units.find((u) => u.id === unitId);
    if (!unit) return;
    const ids = unit.lessons.map((l) => l.id);
    const i = ids.indexOf(lessonId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.reorderLessons(session.token, slug, productId, unitId, ids)).then(load);
  }

  if (error && !data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <Message type="error">{error}</Message>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> {t("studio.loading")}</div>
      </div>
    );
  }

  const editable = data.canAuthor && data.status !== "Published" && data.status !== "Archived";

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <BackLink onBack={onBack} />

      <div className="lw-eyebrow">{t("studio.eyebrowWithProduct", { product: data.productTitle, status: human(t, data.productStatus) })}</div>
      <div className="lw-studio__heading">
        <h1>{data.title ?? t("studio.curriculumFallback")}</h1>
        <span className={`lw-studio__pill is-${data.status.toLowerCase()}`}>{human(t, data.status)}</span>
      </div>
      <p className="lw-sub">{t("studio.lead", { product: data.productTitle })}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {data.canAuthor && (
        <div className="lw-studio__bar">
          {data.status === "Published" ? (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                    onClick={() => run(() => api.curriculumTransition(session.token, slug, productId, "unpublish"), t("studio.toastCurriculumUnpublished")).then(load)}>
              <Undo2 size={13} /> {t("studio.editMode")}
            </button>
          ) : data.status !== "Archived" && (
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!data.publicationBlocker}
                    onClick={() => run(() => api.curriculumTransition(session.token, slug, productId, "publish"), t("studio.toastCurriculumPublished")).then(load)}>
              <Globe size={13} /> {t("studio.publishCurriculum")}
            </button>
          )}
        </div>
      )}

      {data.publicationBlocker && (
        <div className="lw-studio__blocker"><AlertCircle size={14} /> {data.publicationBlocker}</div>
      )}

      {data.canAuthor && data.status === "Published" && (
        <p className="muted" style={{ margin: "-6px 0 16px" }}>
          {t("studio.publishedNoticePrefix")} <strong>{t("studio.editMode")}</strong> {t("studio.publishedNoticeSuffix")}
        </p>
      )}

      {editable && !data.publicationBlocker && data.status !== "Published" && (
        <p className="muted" style={{ margin: "-6px 0 16px" }}>{t("studio.publishHint")}</p>
      )}


      {editable && (
        <NewUnitForm busy={busy} onAdd={(title) =>
          run(() => api.addUnit(session.token, slug, productId, title), t("studio.toastUnitAdded", { title })).then(load)} />
      )}

      {data.units.length === 0 && (
        <div className="lw-studio__empty">
          <Layers size={26} />
          {editable ? (
            <>
              <h2>{t("studio.buildTitle")}</h2>
              <ol className="lw-studio__steps">
                <li><strong>{t("studio.stepAddUnit")}</strong> {t("studio.stepAddUnitRest")}</li>
                <li><strong>{t("studio.stepAddLessons")}</strong> {t("studio.stepAddLessonsRest")}</li>
                <li><strong>{t("studio.stepOpenLesson")}</strong> {t("studio.stepOpenLessonRest")}</li>
              </ol>
            </>
          ) : (
            <>
              <h2>{t("studio.noUnitsTitle")}</h2>
              <p>{t("studio.noUnitsBody")}</p>
            </>
          )}
        </div>
      )}

      <div className="lw-studio__units">
        {data.units.map((u, i) => (
          <UnitCard
            key={u.id} unit={u} editable={editable} busy={busy}
            isFirst={i === 0} isLast={i === data.units.length - 1}
            unplacedLessons={data.unplacedLessons}
            onOpenLesson={setOpenLessonId}
            onRename={(title) => run(() => api.renameUnit(session.token, slug, productId, u.id, title), t("studio.toastUnitRenamed", { title })).then(load)}
            onRemove={() => run(() => api.removeUnit(session.token, slug, productId, u.id), t("studio.toastUnitRemoved", { title: u.title })).then(load)}
            onCreateLesson={(title) => run(() => api.createLesson(session.token, slug, productId, title, u.id), t("studio.toastLessonCreated", { title })).then(load)}
            onPlaceExisting={(lessonId) => run(() => api.placeLesson(session.token, slug, productId, u.id, lessonId), t("studio.toastLessonPlaced")).then(load)}
            onUnplace={(lessonId) => run(() => api.unplaceLesson(session.token, slug, productId, u.id, lessonId), t("studio.toastLessonUnplaced")).then(load)}
            onMoveUnit={(direction) => moveUnit(u.id, direction)}
            onMoveLesson={(lessonId, direction) => moveLesson(u.id, lessonId, direction)}
          />
        ))}
      </div>

      {data.unplacedLessons.length > 0 && (
        <>
          <h2 className="lw-sectiontitle">{t("studio.notInUnit")}</h2>
          <p className="lw-sub" style={{ marginTop: -8 }}>{t("studio.notInUnitLead")}</p>
          <div className="lw-studio__lessonlist">
            {data.unplacedLessons.map((l) => (
              <LessonRowView key={l.id} lesson={l} onOpen={() => setOpenLessonId(l.id)} />
            ))}
          </div>
        </>
      )}

      {editable && data.units.length === 0 && (
        <>
          <p className="muted" style={{ marginTop: 14 }}>{t("studio.preferWriting")}</p>
          <NewLessonOnlyForm busy={busy}
            onAdd={(title) => run(() => api.createLesson(session.token, slug, productId, title, null), t("studio.toastLessonCreated", { title })).then(load)} />
        </>
      )}

      {!data.canAuthor && (
        <p className="lw-studio__readonly">{t("studio.readonlyNote")}</p>
      )}

      {openLessonId && (
        <LessonEditor
          key={openLessonId}
          lessonId={openLessonId}
          editable={editable}
          onClose={() => setOpenLessonId(null)}
          onChanged={load}
          onDuplicated={setOpenLessonId}
        />
      )}
    </div>
  );
}

function BackLink({ onBack }) {
  const { t } = useLanguage();
  return (
    <button className="lw-studio__back" onClick={onBack}>
      <ArrowLeft size={13} /> {t("studio.backAllProducts")}
    </button>
  );
}

function NewUnitForm({ busy, onAdd }) {
  const { t } = useLanguage();
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
               placeholder={t("studio.unitPlaceholder")}
               style={{ width: "100%", ...(attempted ? invalidFieldStyle : {}) }} />
        {attempted && <span className="lw-studio__fielderror">{t("studio.enterTitleFirst")}</span>}
      </div>
      <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
        <Plus size={13} /> {t("studio.addUnit")}
      </button>
    </form>
  );
}

function NewLessonOnlyForm({ busy, onAdd }) {
  const { t } = useLanguage();
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
               placeholder={t("studio.lessonOnlyPlaceholder")}
               style={{ width: "100%", ...(attempted ? invalidFieldStyle : {}) }} />
        {attempted && <span className="lw-studio__fielderror">{t("studio.enterTitleFirst")}</span>}
      </div>
      <button type="submit" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}>
        <FileText size={13} /> {t("studio.newLesson")}
      </button>
    </form>
  );
}

function UnitCard({
  unit, editable, busy, isFirst, isLast, unplacedLessons, onOpenLesson,
  onRename, onRemove, onCreateLesson, onPlaceExisting, onUnplace, onMoveUnit, onMoveLesson,
}) {
  const { t } = useLanguage();
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
            <button type="submit" aria-label={t("studio.save")}><Check size={13} /></button>
          </form>
        ) : (
          <span className="lw-studio__unittitle">
            <span className="lw-studio__unitnum">{unit.position + 1}</span> {unit.title}
          </span>
        )}
        {editable && !renaming && (
          <div className="lw-studio__unitactions">
            <button aria-label={t("studio.moveUnitUp")} disabled={isFirst} onClick={() => onMoveUnit(-1)}><ChevronUp size={12} /></button>
            <button aria-label={t("studio.moveUnitDown")} disabled={isLast} onClick={() => onMoveUnit(1)}><ChevronDown size={12} /></button>
            <button aria-label={t("studio.renameUnit")} onClick={() => { setTitle(unit.title); setRenaming(true); }}><Pencil size={12} /></button>
            <button aria-label={t("studio.removeUnit")} onClick={onRemove}><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      {unit.lessons.length === 0 && (
        <div className="lw-studio__unitempty">
          {editable ? t("studio.noLessonsEditable") : t("studio.noLessonsReadonly")}
        </div>
      )}

      <div className="lw-studio__lessonlist">
        {unit.lessons.map((l, i) => (
          <LessonRowView
            key={l.id} lesson={l} onOpen={() => onOpenLesson(l.id)}
            onRemove={editable ? () => onUnplace(l.id) : null}
            editable={editable} isFirst={i === 0} isLast={i === unit.lessons.length - 1}
            onMove={(direction) => onMoveLesson(l.id, direction)}
          />
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
                     placeholder={t("studio.newLessonTitlePlaceholder")} disabled={busy}
                     style={{ width: "100%", ...(lessonAttempted ? invalidFieldStyle : {}) }} />
              {lessonAttempted && <span className="lw-studio__fielderror">{t("studio.enterTitleFirst")}</span>}
            </div>
            <button type="submit" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}>
              <Plus size={12} /> {t("studio.addLesson")}
            </button>
          </form>
          {unplacedLessons.length > 0 && (
            <select disabled={busy} defaultValue=""
                    onChange={(e) => { if (e.target.value) { onPlaceExisting(e.target.value); e.target.value = ""; } }}>
              <option value="" disabled>{t("studio.placeExisting")}</option>
              {unplacedLessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

function LessonRowView({ lesson, onOpen, onRemove, editable, isFirst, isLast, onMove }) {
  const { t } = useLanguage();
  return (
    <div className="lw-studio__lessonrow">
      {editable && onMove && (
        <div className="lw-studio__lessonmove">
          <button aria-label={t("studio.moveLessonUp")} disabled={isFirst} onClick={() => onMove(-1)}><ChevronUp size={12} /></button>
          <button aria-label={t("studio.moveLessonDown")} disabled={isLast} onClick={() => onMove(1)}><ChevronDown size={12} /></button>
        </div>
      )}
      <button className="lw-studio__lessonopen" onClick={onOpen}>
        <FileText size={13} />
        <span className="lw-studio__lessontitle">{lesson.title}</span>
        <span className={`lw-studio__pill is-${lesson.status.toLowerCase()}`}>{human(t, lesson.status)}</span>
        {lesson.hasOpenDraft && <span className="lw-studio__pill is-draftopen">{t("studio.draftOpen")}</span>}
        {lesson.estimatedMinutes != null && <span className="lw-studio__mins">{lesson.estimatedMinutes} {t("studio.min")}</span>}
      </button>
      {onRemove && (
        <button className="lw-studio__lessonremove" aria-label={t("studio.removeFromUnit")} onClick={onRemove}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

/* ── Lesson editor overlay ─────────────────────────────────────────────── */

function LessonEditor({ lessonId, editable, onClose, onChanged, onDuplicated }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [whatYoullLearn, setWhatYoullLearn] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [glossary, setGlossary] = useState("");
  const [homework, setHomework] = useState("");
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

  // AI Capability Architecture §8 — drafts from the title if Content is
  // empty, improves it otherwise. Uses whatever's currently typed, not the
  // saved revision, so it reflects unsaved edits.
  const [aiBodyBusy, setAiBodyBusy] = useState(false);
  const [aiBodyError, setAiBodyError] = useState(null);

  async function handleSuggestBody() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiBodyError(null);
    setAiBodyBusy(true);
    try {
      const r = await api.suggestLessonBody(session.token, slug, lessonId, {
        title: title.trim(),
        body: body.trim() || null,
        estimatedMinutes: minutes === "" ? null : Number(minutes),
      });
      setBody(r.body);
    } catch (e) {
      setAiBodyError(e.message);
    } finally {
      setAiBodyBusy(false);
    }
  }

  // AI "What You'll Learn" - Implementation Plan §4 — same fill-the-field
  // pattern as handleSuggestBody. The transcript, if any, is looked up
  // server-side off the lesson's own revision, not sent from here.
  const [aiOutcomesBusy, setAiOutcomesBusy] = useState(false);
  const [aiOutcomesError, setAiOutcomesError] = useState(null);

  async function handleSuggestWhatYoullLearn() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiOutcomesError(null);
    setAiOutcomesBusy(true);
    try {
      const r = await api.suggestWhatYoullLearn(session.token, slug, lessonId, {
        title: title.trim(),
        body: body.trim() || null,
      });
      setWhatYoullLearn(r.whatYoullLearn);
    } catch (e) {
      setAiOutcomesError(e.message);
    } finally {
      setAiOutcomesBusy(false);
    }
  }

  // AI Capability Architecture §8 "Generate Lesson Title" — grounded in Body
  // (or a Ready transcript, looked up server-side), not the "empty vs.
  // non-empty" fill pattern the other fields use, since a lesson always has
  // some title by the time a tutor is here.
  const [aiTitleBusy, setAiTitleBusy] = useState(false);
  const [aiTitleError, setAiTitleError] = useState(null);

  async function handleSuggestTitle() {
    if (!body.trim()) { setActiveTab("content"); return; }
    setAiTitleError(null);
    setAiTitleBusy(true);
    try {
      const r = await api.suggestLessonTitle(session.token, slug, lessonId, {
        title: title.trim() || null,
        body: body.trim() || null,
      });
      setTitle(r.title);
    } catch (e) {
      setAiTitleError(e.message);
    } finally {
      setAiTitleBusy(false);
    }
  }

  // AI Authoring Assistant Architecture Stage 5 — same fill-the-field
  // pattern as handleSuggestWhatYoullLearn; the transcript, if any, is
  // looked up server-side off the lesson's own revision.
  const [aiObjectivesBusy, setAiObjectivesBusy] = useState(false);
  const [aiObjectivesError, setAiObjectivesError] = useState(null);

  async function handleSuggestLearningObjectives() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiObjectivesError(null);
    setAiObjectivesBusy(true);
    try {
      const r = await api.suggestLearningObjectives(session.token, slug, lessonId, {
        title: title.trim(),
        body: body.trim() || null,
      });
      setLearningObjectives(r.learningObjectives);
    } catch (e) {
      setAiObjectivesError(e.message);
    } finally {
      setAiObjectivesBusy(false);
    }
  }

  // AI Capability Architecture §8 "Generate Glossary"/"Generate Keywords" —
  // same fill-the-field pattern; transcript, if any, looked up server-side.
  const [aiGlossaryBusy, setAiGlossaryBusy] = useState(false);
  const [aiGlossaryError, setAiGlossaryError] = useState(null);

  async function handleSuggestGlossary() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiGlossaryError(null);
    setAiGlossaryBusy(true);
    try {
      const r = await api.suggestGlossary(session.token, slug, lessonId, {
        title: title.trim(),
        body: body.trim() || null,
      });
      setGlossary(r.glossary);
    } catch (e) {
      setAiGlossaryError(e.message);
    } finally {
      setAiGlossaryBusy(false);
    }
  }

  // AI Authoring Assistant Architecture Stage 8 "Supporting Resources" —
  // same fill-the-field pattern; transcript, if any, looked up server-side.
  const [aiHomeworkBusy, setAiHomeworkBusy] = useState(false);
  const [aiHomeworkError, setAiHomeworkError] = useState(null);

  async function handleSuggestHomework() {
    if (!title.trim()) { setAttempted(true); return; }
    setAiHomeworkError(null);
    setAiHomeworkBusy(true);
    try {
      const r = await api.suggestHomework(session.token, slug, lessonId, {
        title: title.trim(),
        body: body.trim() || null,
      });
      setHomework(r.homework);
    } catch (e) {
      setAiHomeworkError(e.message);
    } finally {
      setAiHomeworkBusy(false);
    }
  }

  const load = useCallback(
    () => api.getLesson(session.token, slug, lessonId).then((l) => {
      setLesson(l);
      // No open draft doesn't mean nothing to show — a Published lesson with
      // no draft is exactly the quick-edit case (Scenario 3), so the form
      // falls back to the current revision's own values, not blanks.
      const source = l.draftRevision ?? l.currentRevision;
      setTitle(source?.title ?? l.title);
      setBody(source?.body ?? "");
      setWhatYoullLearn(source?.whatYoullLearn ?? "");
      setLearningObjectives(source?.learningObjectives ?? "");
      setGlossary(source?.glossary ?? "");
      setHomework(source?.homework ?? "");
      setMinutes(source?.estimatedMinutes ?? "");
      setDeliveryMode(source?.deliveryMode ?? "Recorded");
      setError(null);
      return l;
    }).catch((e) => { setError(e.message); return null; }),
    [session.token, slug, lessonId]);

  useEffect(() => { load(); }, [load]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await fn();
      if (successMessage) setSuccess(successMessage);
      onChanged();
      return result;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  function draftPayload(overrides = {}) {
    return {
      title: title.trim(),
      body: body.trim() || null,
      whatYoullLearn: whatYoullLearn.trim() || null,
      learningObjectives: learningObjectives.trim() || null,
      glossary: glossary.trim() || null,
      homework: homework.trim() || null,
      estimatedMinutes: minutes === "" ? null : Number(minutes),
      deliveryMode,
      ...overrides,
    };
  }

  function handleSaveDraft() {
    if (!title.trim()) { setActiveTab("content"); setAttempted(true); return; }
    run(() => api.saveLessonDraft(session.token, slug, lessonId, draftPayload()), t("studio.toastDraftSaved"))
      .then((l) => l && setLesson(l));
  }

  function handlePublish() {
    if (!body.trim()) { setActiveTab("content"); setPublishAttempted(true); return; }
    const draftRevision = lesson.draftRevision;
    const hasVideo = !!draftRevision?.video || !!draftRevision?.videoUrl;
    if (deliveryMode === "Recorded" && !hasVideo) { setActiveTab("delivery"); setPublishAttempted(true); return; }
    // Publish always saves first — otherwise it would publish whatever was
    // last saved, silently dropping unsaved edits sitting in the form right now.
    run(async () => {
      await api.saveLessonDraft(session.token, slug, lessonId, draftPayload());
      return api.lessonTransition(session.token, slug, lessonId, "publish");
    }, t("studio.toastLessonPublished")).then((l) => l && setLesson(l));
  }

  /** Lesson Editing & Publication UX, Scenario 3 — no new revision, no republish. */
  function handleQuickSave() {
    if (!title.trim() || !body.trim()) { setAttempted(true); return; }
    run(() => api.quickEditPublishedLesson(session.token, slug, lessonId, {
      title: title.trim(), body: body.trim() || null, whatYoullLearn: whatYoullLearn.trim() || null,
      learningObjectives: learningObjectives.trim() || null, glossary: glossary.trim() || null,
      homework: homework.trim() || null,
      estimatedMinutes: minutes === "" ? null : Number(minutes),
    }), t("studio.toastChangesSaved")).then((l) => l && setLesson(l));
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
    const started = await run(() => api.startLessonRevision(session.token, slug, lessonId), t("studio.toastNewVersionStarted"));
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
    const clone = await run(() => api.duplicateLesson(session.token, slug, lessonId), t("studio.toastLessonDuplicated"));
    if (clone) onDuplicated(clone.id);
  }

  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lw-studio__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onClose} aria-label={t("studio.close")}><X size={16} /></button>

        {!lesson && !error && (
          <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> {t("studio.loading")}</div>
        )}
        {error && <Message type="error">{error}</Message>}
        {success && <Message type="success">{success}</Message>}

        {lesson && (
          <>
            <div className="lw-eyebrow">{t("studio.lessonEyebrow")}</div>
            <div className="lw-studio__heading">
              <h2 className="lw-studio__panelh2">{title || lesson.title}</h2>
              <span className={`lw-studio__pill is-${lesson.status.toLowerCase()}`}>{human(t, lesson.status)}</span>
            </div>

            {!editable && (
              <p className="lw-studio__panelnote">{t("studio.viewOnlyNote")}</p>
            )}

            {editable && lesson.currentRevision && (
              <p className="lw-studio__panelnote">
                {t("studio.publishedAsRevision", { version: lesson.currentRevision.version })}{" "}
                {lesson.draftRevision ? t("studio.learnersSeeThat") : t("studio.directEditNote")}
              </p>
            )}

            <div className="lw-studio__tabs">
              <button type="button" className={activeTab === "content" ? "active" : ""} onClick={() => setActiveTab("content")}>
                <FileText size={13} /> {t("studio.tabContent")}
              </button>
              <button type="button" className={activeTab === "delivery" ? "active" : ""} onClick={() => setActiveTab("delivery")}>
                <PlayCircle size={13} /> {t("studio.tabDelivery")}
              </button>
              <button type="button" className={activeTab === "questions" ? "active" : ""} onClick={() => setActiveTab("questions")}>
                <Sparkles size={13} /> {t("studio.tabQuestions")}
              </button>
              <button type="button" className={activeTab === "standaloneQuiz" ? "active" : ""} onClick={() => setActiveTab("standaloneQuiz")}>
                <ClipboardCheck size={13} /> {t("studio.tabStandaloneQuiz")}
              </button>
              <button type="button" className={activeTab === "resources" ? "active" : ""} onClick={() => setActiveTab("resources")}>
                <Paperclip size={13} /> {t("studio.tabResources")}
              </button>
            </div>

            {activeTab === "content" && (lesson.draftRevision ? (
              <div className="lw-studio__draftform">
                {attempted && !title.trim() && (
                  <Message type="error">{t("studio.titleRequired")}</Message>
                )}
                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.titleLabel")}<RequiredMark />
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestTitle}
                              disabled={busy || aiTitleBusy || !body.trim()} title={t("studio.aiSuggestTitle")}>
                        {aiTitleBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestTitle")}
                      </button>
                    )}
                  </span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy || !editable} required
                         style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
                  {aiTitleError && <Message type="error">{aiTitleError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.whatYoullLearnLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestWhatYoullLearn}
                              disabled={busy || aiOutcomesBusy || !title.trim()} title={t("studio.aiSuggestWhatYoullLearn")}>
                        {aiOutcomesBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestWhatYoullLearn")}
                      </button>
                    )}
                  </span>
                  <textarea rows={3} value={whatYoullLearn} onChange={(e) => setWhatYoullLearn(e.target.value)}
                            placeholder={t("studio.whatYoullLearnPlaceholder")}
                            disabled={busy || !editable} />
                  {aiOutcomesError && <Message type="error">{aiOutcomesError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.learningObjectivesLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestLearningObjectives}
                              disabled={busy || aiObjectivesBusy || !title.trim()} title={t("studio.aiSuggestLearningObjectives")}>
                        {aiObjectivesBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestLearningObjectives")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={learningObjectives} onChange={(e) => setLearningObjectives(e.target.value)}
                            placeholder={t("studio.learningObjectivesPlaceholder")}
                            disabled={busy || !editable} />
                  {aiObjectivesError && <Message type="error">{aiObjectivesError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.glossaryLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestGlossary}
                              disabled={busy || aiGlossaryBusy || !title.trim()} title={t("studio.aiSuggestGlossary")}>
                        {aiGlossaryBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestGlossary")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={glossary} onChange={(e) => setGlossary(e.target.value)}
                            placeholder={t("studio.glossaryPlaceholder")}
                            disabled={busy || !editable} />
                  {aiGlossaryError && <Message type="error">{aiGlossaryError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.homeworkLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestHomework}
                              disabled={busy || aiHomeworkBusy || !title.trim()} title={t("studio.aiSuggestHomework")}>
                        {aiHomeworkBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestHomework")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={homework} onChange={(e) => setHomework(e.target.value)}
                            placeholder={t("studio.homeworkPlaceholder")}
                            disabled={busy || !editable} />
                  {aiHomeworkError && <Message type="error">{aiHomeworkError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.contentLabel")}<RequiredMark />
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestBody}
                              disabled={busy || aiBodyBusy || !title.trim()} title={t("studio.aiSuggestBody")}>
                        {aiBodyBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestBody")}
                      </button>
                    )}
                  </span>
                  <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)}
                            placeholder={t("studio.contentPlaceholder")}
                            disabled={busy || !editable}
                            style={publishAttempted && !body.trim() ? invalidFieldStyle : undefined} />
                  {aiBodyError && <Message type="error">{aiBodyError}</Message>}
                </label>
                <label className="lw-studio__minsfield">
                  <span>{t("studio.estimatedMinutes")}</span>
                  <input type="number" min="0" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} disabled={busy || !editable} />
                </label>
                {editable && (
                  <p className="muted" style={{ margin: 0 }}>
                    <strong>{t("studio.saveDraftHintPrefix")}</strong> {t("studio.saveDraftHintMid")} <strong>{t("studio.saveDraftHintPublish")}</strong> {t("studio.saveDraftHintSuffix")}
                  </p>
                )}
                {publishAttempted && !body.trim() && (
                  <Message type="error">{t("studio.addContentBeforePublish")}</Message>
                )}
              </div>
            ) : lesson.currentRevision ? (
              // Lesson Editing & Publication UX, Scenario 3: Title, Content and
              // Estimated minutes are safe to change on the published revision
              // directly — no draft, no republish, just Save changes.
              <div className="lw-studio__draftform">
                {attempted && (!title.trim() || !body.trim()) && (
                  <Message type="error">{t("studio.titleContentRequired")}</Message>
                )}
                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.titleLabel")}<RequiredMark />
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestTitle}
                              disabled={busy || aiTitleBusy || !body.trim()} title={t("studio.aiSuggestTitle")}>
                        {aiTitleBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestTitle")}
                      </button>
                    )}
                  </span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy || !editable} required
                         style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
                  {aiTitleError && <Message type="error">{aiTitleError}</Message>}
                </label>
                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.whatYoullLearnLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestWhatYoullLearn}
                              disabled={busy || aiOutcomesBusy || !title.trim()} title={t("studio.aiSuggestWhatYoullLearn")}>
                        {aiOutcomesBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestWhatYoullLearn")}
                      </button>
                    )}
                  </span>
                  <textarea rows={3} value={whatYoullLearn} onChange={(e) => setWhatYoullLearn(e.target.value)}
                            placeholder={t("studio.whatYoullLearnPlaceholder")}
                            disabled={busy || !editable} />
                  {aiOutcomesError && <Message type="error">{aiOutcomesError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.learningObjectivesLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestLearningObjectives}
                              disabled={busy || aiObjectivesBusy || !title.trim()} title={t("studio.aiSuggestLearningObjectives")}>
                        {aiObjectivesBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestLearningObjectives")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={learningObjectives} onChange={(e) => setLearningObjectives(e.target.value)}
                            placeholder={t("studio.learningObjectivesPlaceholder")}
                            disabled={busy || !editable} />
                  {aiObjectivesError && <Message type="error">{aiObjectivesError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.glossaryLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestGlossary}
                              disabled={busy || aiGlossaryBusy || !title.trim()} title={t("studio.aiSuggestGlossary")}>
                        {aiGlossaryBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestGlossary")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={glossary} onChange={(e) => setGlossary(e.target.value)}
                            placeholder={t("studio.glossaryPlaceholder")}
                            disabled={busy || !editable} />
                  {aiGlossaryError && <Message type="error">{aiGlossaryError}</Message>}
                </label>

                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.homeworkLabel")}
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestHomework}
                              disabled={busy || aiHomeworkBusy || !title.trim()} title={t("studio.aiSuggestHomework")}>
                        {aiHomeworkBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestHomework")}
                      </button>
                    )}
                  </span>
                  <textarea rows={4} value={homework} onChange={(e) => setHomework(e.target.value)}
                            placeholder={t("studio.homeworkPlaceholder")}
                            disabled={busy || !editable} />
                  {aiHomeworkError && <Message type="error">{aiHomeworkError}</Message>}
                </label>
                <label>
                  <span className="lw-studio__contentlabel">
                    {t("studio.contentLabel")}<RequiredMark />
                    {editable && (
                      <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" onClick={handleSuggestBody}
                              disabled={busy || aiBodyBusy || !title.trim()} title={t("studio.aiSuggestBody")}>
                        {aiBodyBusy
                          ? <LoaderCircle size={12} className="lw-studio__spin" />
                          : <Sparkles size={12} />} {t("studio.aiSuggestBody")}
                      </button>
                    )}
                  </span>
                  <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} disabled={busy || !editable}
                            style={attempted && !body.trim() ? invalidFieldStyle : undefined} />
                  {aiBodyError && <Message type="error">{aiBodyError}</Message>}
                </label>
                <label className="lw-studio__minsfield">
                  <span>{t("studio.estimatedMinutes")}</span>
                  <input type="number" min="0" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} disabled={busy || !editable} />
                </label>
                {editable && (
                  <>
                    <p className="muted" style={{ margin: 0 }}>
                      {t("studio.publishedDirectNotePrefix")} <strong>{t("studio.publishedDirectNoteBold")}</strong> {t("studio.publishedDirectNoteSuffix")}
                    </p>
                    <div className="lw-studio__panelactions">
                      <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={handleQuickSave}>
                        {t("studio.saveChanges")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="lw-studio__nodraft">
                <p>{t("studio.noContentYet")}</p>
                {editable && (
                  <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}
                          onClick={() => run(() => api.startLessonRevision(session.token, slug, lessonId), t("studio.toastNewVersionStarted")).then((l) => l && setLesson(l))}>
                    <Plus size={13} /> {t("studio.startNewRevision")}
                  </button>
                )}
              </div>
            ))}

            {activeTab === "delivery" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <>
                  <div className="lw-studio__draftform" style={{ marginBottom: 20 }}>
                    <label>
                      <span>{t("studio.deliveryType")}</span>
                      <select
                        value={deliveryMode} disabled={busy || !editable}
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
                        <option value="Recorded">{t("studio.recordedVideo")}</option>
                        <option value="LiveSession">{t("studio.liveSession")}</option>
                      </select>
                    </label>
                  </div>
                  <VideoSection
                    lesson={lesson}
                    editable={editable}
                    hasDraft={!!lesson.draftRevision}
                    deliveryMode={deliveryMode}
                    publishAttempted={publishAttempted}
                    onChanged={load}
                    onDurationKnown={setVideoDuration}
                    onRequestNewVersion={() => setVersionDialogTrigger("video")}
                  />
                </>
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForDelivery")}</p>
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
                  editable={editable}
                  videoDurationSeconds={videoDuration}
                />
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForQuestions")}</p>
              )
            )}

            {activeTab === "standaloneQuiz" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <StandaloneAssessmentSection lessonId={lesson.id} editable={editable} />
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForQuestions")}</p>
              )
            )}

            {activeTab === "resources" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <ResourcesSection
                  lesson={lesson}
                  editable={editable}
                  onChanged={load}
                />
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForResources")}</p>
              )
            )}

            {editable && (
              <div className="lw-studio__panelfooter">
                {lesson.draftRevision && (
                  <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={handleSaveDraft}>
                    {t("studio.saveDraft")}
                  </button>
                )}
                {lesson.draftRevision && lesson.status !== "Archived" && (
                  <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={handlePublish}>
                    <Globe size={13} /> {t("studio.publish")}
                  </button>
                )}
                {lesson.status === "Published" && (
                  <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                          onClick={() => run(() => api.lessonTransition(session.token, slug, lessonId, "unpublish"), t("studio.toastLessonUnpublished")).then((l) => l && setLesson(l))}>
                    <Undo2 size={13} /> {t("studio.unpublish")}
                  </button>
                )}
                {lesson.status !== "Archived" && (
                  <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                          onClick={() => run(() => api.lessonTransition(session.token, slug, lessonId, "archive"), t("studio.toastLessonArchived")).then((l) => l && setLesson(l))}>
                    <Archive size={13} /> {t("studio.archiveLesson")}
                  </button>
                )}
              </div>
            )}

            {lesson.history.length > 1 && (
              <details className="lw-studio__history">
                <summary>{t("studio.revisionHistory", { count: lesson.history.length })}</summary>
                <ul>
                  {lesson.history.map((r) => (
                    <li key={r.id}>
                      v{r.version} — {r.title}
                      <span className={`lw-studio__pill is-${r.status.toLowerCase()}`}>{human(t, r.status)}</span>
                      {r.questionCount > 0 && (
                        <span className="lw-studio__historymeta">
                          {r.questionCount} {r.questionCount === 1 ? t("studio.question") : t("studio.questions")}
                          {r.submissionCount > 0 && ` · ${r.submissionCount} ${r.submissionCount === 1 ? t("studio.submission") : t("studio.submissions")}`}
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
  const { t } = useLanguage();
  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="lw-studio__panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onCancel} aria-label={t("studio.close")}><X size={16} /></button>
        <div className="lw-eyebrow">{t("studio.newVersionEyebrow")}</div>
        <h2 className="lw-studio__panelh2">
          {trigger === "video" ? t("studio.replacingVideoTitle") : t("studio.changingDeliveryTitle")}
        </h2>
        <p className="lw-studio__panelnote">
          {trigger === "video" ? t("studio.replacingVideoNote") : t("studio.changingDeliveryNote")}
        </p>

        <div className="lw-studio__versionoptions">
          <div className="lw-studio__versionoption">
            <h3>{t("studio.createNewVersion")}</h3>
            <ul>
              <li>{t("studio.newVersionLi1")}</li>
              <li>{t("studio.newVersionLi2")}</li>
              <li>{t("studio.newVersionLi3")}</li>
              <li>{t("studio.newVersionLi4")}</li>
            </ul>
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={onChooseNewVersion}>
              {t("studio.createNewVersion")}
            </button>
          </div>
          <div className="lw-studio__versionoption">
            <h3>{t("studio.createNewDraft")}</h3>
            <ul>
              <li>{t("studio.newDraftLi1")}</li>
              <li>{t("studio.newDraftLi2")}</li>
              <li>{t("studio.newDraftLi3")}</li>
              <li>{t("studio.newDraftLi4")}</li>
            </ul>
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onChooseNewDraft}>
              {t("studio.createNewDraft")}
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

function VideoSection({ lesson, editable, hasDraft, deliveryMode, publishAttempted, onChanged, onDurationKnown, onRequestNewVersion }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [sourceTab, setSourceTab] = useState("upload");
  const [urlInput, setUrlInput] = useState("");
  const [attachingUrl, setAttachingUrl] = useState(false);

  const revision = lesson.draftRevision ?? lesson.currentRevision;
  const video = revision?.video;
  const videoUrl = revision?.videoUrl;
  const hasVideo = !!video || !!videoUrl;

  // AI Video Transcript — only an uploaded video (not an external URL) can be
  // transcribed (Implementation Plan §3). Poll while Processing since the
  // real work happens on a background job, not this request.
  const transcriptStatus = revision?.transcriptStatus ?? "None";
  const [transcriptError, setTranscriptError] = useState(null);
  const [startingTranscript, setStartingTranscript] = useState(false);

  useEffect(() => {
    if (transcriptStatus !== "Processing") return;
    const id = setInterval(() => { onChanged(); }, 5000);
    return () => clearInterval(id);
  }, [transcriptStatus, onChanged]);

  async function handleGenerateTranscript() {
    setTranscriptError(null);
    setStartingTranscript(true);
    try {
      await api.generateLessonTranscript(session.token, slug, lesson.id);
      onChanged();
    } catch (e) {
      setTranscriptError(e.message);
    } finally {
      setStartingTranscript(false);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const asset = await api.uploadLearningAsset(session.token, slug, file, file.name, setProgress);
      await api.attachLessonVideo(session.token, slug, lesson.id, asset.id);
      setSuccess(t("studio.toastVideoUploaded"));
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
      setSuccess(t("studio.toastVideoLinked"));
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
      setSuccess(t("studio.toastVideoRemoved"));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  const isLive = deliveryMode === "LiveSession";

  return (
    <div className="lw-studio__section">
      <h2 className="lw-sectiontitle">{isLive ? t("studio.recordingTitle") : t("studio.videoTitle")}</h2>
      {isLive && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{t("studio.liveNote")}</p>
      )}
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}
      {!isLive && !hasVideo && publishAttempted && (
        <Message type="error">{t("studio.addVideoBeforePublish")}</Message>
      )}

      {!hasVideo && hasDraft && editable && (
        <>
          <div className="lw-segctrl" style={{ marginBottom: 14 }}>
            <button type="button" className={sourceTab === "upload" ? "active" : ""} onClick={() => setSourceTab("upload")}>
              <UploadCloud size={13} /> {t("studio.upload")}
            </button>
            <button type="button" className={sourceTab === "url" ? "active" : ""} onClick={() => setSourceTab("url")}>
              <LinkIcon size={13} /> {t("studio.url")}
            </button>
          </div>

          {sourceTab === "upload" ? (
            uploading ? (
              <div className="lw-dropzone lw-dropzone--compact">
                <LoaderCircle size={24} className="lw-studio__spin" />
                <span className="lw-dropzone__title">{t("studio.uploadingPct", { pct: Math.round(progress * 100) })}</span>
              </div>
            ) : (
              <div className="lw-dropzone" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
                <UploadCloud size={26} />
                <span className="lw-dropzone__title">{isLive ? t("studio.uploadRecordingOptional") : t("studio.uploadLessonVideo")}</span>
                <span className="lw-dropzone__meta">{isLive ? t("studio.recordingHint") : t("studio.videoHint")}</span>
                <input
                  ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            )
          ) : (
            <div className="lw-studio__draftform">
              <label>
                <span>{t("studio.videoUrlLabel")}</span>
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                       placeholder={t("studio.videoUrlPlaceholder")} disabled={attachingUrl} />
              </label>
              <div className="lw-studio__panelactions">
                <button type="button" className="lw-btn lw-btn--accent lw-btn--sm"
                        disabled={attachingUrl || !urlInput.trim()} onClick={handleAttachUrl}>
                  {attachingUrl ? <LoaderCircle size={13} className="lw-studio__spin" /> : <LinkIcon size={13} />} {t("studio.attach")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!hasVideo && !editable && (
        <div className="lw-studio__unitempty">{t("studio.noVideo")}</div>
      )}

      {!hasVideo && !hasDraft && editable && (
        <div className="lw-studio__unitempty" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{t("studio.noVideoYet")}</span>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
            <UploadCloud size={13} /> {t("studio.addVideo")}
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
            {editable && (hasDraft ? (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={handleRemove}>
                <Trash2 size={13} /> {t("studio.remove")}
              </button>
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
                <UploadCloud size={13} /> {t("studio.replaceVideo")}
              </button>
            ))}
          </div>

          <div className="lw-transcript" style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
            {transcriptError && <Message type="error">{transcriptError}</Message>}

            {transcriptStatus === "None" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span className="muted">{t("studio.transcriptNone")}</span>
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={startingTranscript} onClick={handleGenerateTranscript}>
                  {startingTranscript ? <LoaderCircle size={13} className="lw-studio__spin" /> : <Sparkles size={13} />} {t("studio.generateTranscript")}
                </button>
              </div>
            )}

            {transcriptStatus === "Processing" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LoaderCircle size={13} className="lw-studio__spin" />
                <span className="muted">{t("studio.transcriptProcessing")}</span>
              </div>
            )}

            {transcriptStatus === "Failed" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span className="muted">{revision.transcriptError ?? t("studio.transcriptFailed")}</span>
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={startingTranscript} onClick={handleGenerateTranscript}>
                  {startingTranscript ? <LoaderCircle size={13} className="lw-studio__spin" /> : <Sparkles size={13} />} {t("studio.retryTranscript")}
                </button>
              </div>
            )}

            {transcriptStatus === "Ready" && (
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>{t("studio.transcriptReady")}</summary>
                <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{revision.transcript}</p>
              </details>
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
            {editable && (hasDraft ? (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={handleRemove}>
                <Trash2 size={13} /> {t("studio.remove")}
              </button>
            ) : (
              <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onRequestNewVersion}>
                <UploadCloud size={13} /> {t("studio.replaceVideo")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Supplementary files (slides, worksheets, handouts) attached to whichever
 * revision is currently open for editing — the draft if one exists, else
 * the published revision (ContentStudioService.AddResourceAsync's "target
 * revision" rule). Unlike VideoSection, not gated on hasDraft: attaching a
 * handout is safe metadata (LessonRevision.Resources remarks), so a tutor
 * can do it without starting a new revision first.
 */
function ResourcesSection({ lesson, editable, onChanged }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const revision = lesson.draftRevision ?? lesson.currentRevision;
  const resources = revision?.resources ?? [];

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        setProgress(0);
        const asset = await api.uploadLearningAsset(session.token, slug, file, file.name, setProgress, "Resource");
        await api.addLessonResource(session.token, slug, lesson.id, asset.id);
      }
      setSuccess(t("studio.toastResourceUploaded"));
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(resourceId) {
    setError(null);
    try {
      await api.removeLessonResource(session.token, slug, lesson.id, resourceId);
      setSuccess(t("studio.toastResourceRemoved"));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="lw-studio__section">
      <h2 className="lw-sectiontitle">{t("studio.resourcesTitle")}</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{t("studio.resourcesHint")}</p>
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {editable && (
        uploading ? (
          <div className="lw-dropzone lw-dropzone--compact" style={{ marginBottom: 14 }}>
            <LoaderCircle size={24} className="lw-studio__spin" />
            <span className="lw-dropzone__title">{t("studio.uploadingPct", { pct: Math.round(progress * 100) })}</span>
          </div>
        ) : (
          <div className="lw-dropzone" style={{ marginBottom: 14 }} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0}>
            <UploadCloud size={26} />
            <span className="lw-dropzone__title">{t("studio.uploadResource")}</span>
            <span className="lw-dropzone__meta">{t("studio.resourceHint")}</span>
            <input
              ref={fileInputRef} type="file" multiple style={{ display: "none" }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        )
      )}

      {resources.length === 0 && (
        <div className="lw-studio__unitempty">{t("studio.noResources")}</div>
      )}

      {resources.length > 0 && (
        <div className="lw-player">
          {resources.map((r, i) => (
            <div key={r.id} className="lw-videosource"
                 style={{ padding: "12px 16px", flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
              <a href={api.learningAssetDownloadUrl(session.token, slug, r.asset.id)} target="_blank" rel="noreferrer"
                 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)", textDecoration: "none", minWidth: 0 }}>
                <Paperclip size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.asset.title}</span>
                <span className="lw-tag lw-tag--source" style={{ flexShrink: 0 }}>{Math.round(r.asset.fileSizeBytes / 1024)} KB</span>
              </a>
              {editable ? (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => handleRemove(r.id)}>
                  <Trash2 size={13} /> {t("studio.remove")}
                </button>
              ) : (
                <Download size={14} className="muted" />
              )}
            </div>
          ))}
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

const ANALYZE_STEP_KEYS = ["studio.analyzeStep0", "studio.analyzeStep1", "studio.analyzeStep2"];

function AssessmentSection({ lessonId, editable, videoDurationSeconds }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function handleAiSuggest() {
    if (!videoDurationSeconds) return;
    setSuggesting(true);
    setError(null);
    for (let i = 0; i < ANALYZE_STEP_KEYS.length; i++) {
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
    }), t("studio.toastQuestionAdded"));
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
      ? await run(() => api.addQuestion(session.token, slug, lessonId, body), t("studio.toastQuestionAdded"))
      : await run(() => api.updateQuestion(session.token, slug, lessonId, formMode.id, body), t("studio.toastQuestionUpdated"));
    if (result) { setData(result); setFormMode(null); }
  }

  async function removeQuestion(questionId) {
    const result = await run(() => api.removeQuestion(session.token, slug, lessonId, questionId), t("studio.toastQuestionRemoved"));
    if (result) setData(result);
  }

  if (!data) {
    return (
      <div className="lw-studio__section">
        <h2 className="lw-sectiontitle">{t("studio.interactiveQuestions")}</h2>
        <div className="lw-studio__loading"><LoaderCircle size={16} className="lw-studio__spin" /> {t("studio.loading")}</div>
      </div>
    );
  }

  // Lesson Editing & Publication UX, Scenario 4: independent of this
  // Assessment's own Draft/Published state — Publish/Unpublish below stay
  // purely about learner visibility. `editable` here is the curriculum-level
  // Edit Mode toggle instead: questions are view only while the curriculum
  // is published, same as everything else in this lesson.

  return (
    <div className="lw-studio__section">
      <div className="lw-studio__heading">
        <h2 className="lw-sectiontitle" style={{ margin: 0 }}>{t("studio.interactiveQuestions")}</h2>
        <span className={`lw-studio__pill is-${data.status.toLowerCase()}`}>{human(t, data.status)}</span>
      </div>
      
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {editable && (
        <div className="lw-studio__bar">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy || suggesting || !videoDurationSeconds}
                  onClick={handleAiSuggest} title={!videoDurationSeconds ? t("studio.uploadVideoFirst") : undefined}>
            <Sparkles size={13} /> {t("studio.askAiSuggest")}
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setFormMode("new")}>
            <Plus size={13} /> {t("studio.addQuestion")}
          </button>
          {data.questions.length > 0 && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setPreviewOpen(true)}>
              <Bot size={13} /> {t("studio.previewAiGrading")}
            </button>
          )}
          {data.status === "Published" ? (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                    onClick={() => run(() => api.assessmentTransition(session.token, slug, lessonId, "unpublish"), t("studio.toastQuestionsUnpublished")).then((r) => r && setData(r))}>
              <Undo2 size={13} /> {t("studio.unpublish")}
            </button>
          ) : (
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!data.publicationBlocker}
                    onClick={() => run(() => api.assessmentTransition(session.token, slug, lessonId, "publish"), t("studio.toastQuestionsPublished")).then((r) => r && setData(r))}>
              <Globe size={13} /> {t("studio.publishQuestions")}
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
            {ANALYZE_STEP_KEYS.map((stepKey, i) => (
              <li key={stepKey} className={i < analyzeStep ? "done" : i === analyzeStep ? "active" : ""}>
                {i < analyzeStep ? <Check size={13} /> : <LoaderCircle size={13} className={i === analyzeStep ? "lw-studio__spin" : ""} />}
                {t(stepKey)}
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
          existingQuestions={data.questions}
          videoDurationSeconds={videoDurationSeconds}
        />
      )}

      {data.questions.length === 0 && suggestions.length === 0 && !formMode && (
        <div className="lw-empty">
          {editable ? t("studio.noQuestionsEditable") : t("studio.noQuestionsReadonly")}
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

/* ── Standalone assessment ────────────────────────────────────────────
   The lesson's second, separate quiz (see AssessmentKind) — its own title,
   own passing threshold, own Submission trail, not synced to the video at
   all. Same shape as AssessmentSection above, with one difference in each
   direction: AI-suggested questions here are grounded in the lesson's text
   (GenerateStandaloneQuestionsSkill) instead of placed against a video
   timestamp, and the question-time field itself is dropped entirely
   (QuestionForm's requireTimestamp=false) since there's no timeline to place
   anything on.
   ========================================================================= */

const STANDALONE_ANALYZE_STEP_KEYS = ["studio.standaloneAnalyzeStep0", "studio.standaloneAnalyzeStep1", "studio.standaloneAnalyzeStep2"];

function StandaloneAssessmentSection({ lessonId, editable }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [suggestions, setSuggestions] = useState([]);

  const [formMode, setFormMode] = useState(null); // null | "new" | Question being edited
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(
    () => api.getStandaloneAssessment(session.token, slug, lessonId)
      .then((d) => { setData(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; }),
    [session.token, slug, lessonId]);

  useEffect(() => { load(); }, [load]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fn();
      if (successMessage) setSuccess(successMessage);
      return r;
    }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function handleAiSuggest() {
    setSuggesting(true);
    setError(null);
    for (let i = 0; i < STANDALONE_ANALYZE_STEP_KEYS.length; i++) {
      setAnalyzeStep(i);
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
    try {
      const result = await api.suggestStandaloneQuestions(session.token, slug, lessonId, 5);
      setSuggestions(result.map((s, i) => ({ ...s, key: `suggestion-${Date.now()}-${i}` })));
    } catch (e) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(s) {
    const result = await run(() => api.addStandaloneQuestion(session.token, slug, lessonId, {
      type: s.type, prompt: s.prompt, options: s.options, correctOptionIndex: s.correctOptionIndex,
      acceptedAnswers: s.acceptedAnswers, explanation: s.explanation,
      videoTimestampSeconds: null, points: s.points,
    }), t("studio.toastQuestionAdded"));
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
      ? await run(() => api.addStandaloneQuestion(session.token, slug, lessonId, body), t("studio.toastQuestionAdded"))
      : await run(() => api.updateStandaloneQuestion(session.token, slug, lessonId, formMode.id, body), t("studio.toastQuestionUpdated"));
    if (result) { setData(result); setFormMode(null); }
  }

  async function removeQuestion(questionId) {
    const result = await run(() => api.removeStandaloneQuestion(session.token, slug, lessonId, questionId), t("studio.toastQuestionRemoved"));
    if (result) setData(result);
  }

  if (!data) {
    return (
      <div className="lw-studio__section">
        <h2 className="lw-sectiontitle">{t("studio.standaloneQuiz")}</h2>
        <div className="lw-studio__loading"><LoaderCircle size={16} className="lw-studio__spin" /> {t("studio.loading")}</div>
      </div>
    );
  }

  return (
    <div className="lw-studio__section">
      <div className="lw-studio__heading">
        <h2 className="lw-sectiontitle" style={{ margin: 0 }}>{t("studio.standaloneQuiz")}</h2>
        <span className={`lw-studio__pill is-${data.status.toLowerCase()}`}>{human(t, data.status)}</span>
      </div>
      <p className="muted" style={{ margin: "-6px 0 14px" }}>{t("studio.standaloneQuizHint")}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {editable && (
        <div className="lw-studio__bar">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy || suggesting} onClick={handleAiSuggest}>
            <Sparkles size={13} /> {t("studio.askAiSuggestQuestions")}
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setFormMode("new")}>
            <Plus size={13} /> {t("studio.addQuestion")}
          </button>
          {data.questions.length > 0 && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setPreviewOpen(true)}>
              <Bot size={13} /> {t("studio.previewAiGrading")}
            </button>
          )}
          {data.status === "Published" ? (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                    onClick={() => run(() => api.standaloneAssessmentTransition(session.token, slug, lessonId, "unpublish"), t("studio.toastQuestionsUnpublished")).then((r) => r && setData(r))}>
              <Undo2 size={13} /> {t("studio.unpublish")}
            </button>
          ) : (
            <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!data.publicationBlocker}
                    onClick={() => run(() => api.standaloneAssessmentTransition(session.token, slug, lessonId, "publish"), t("studio.toastQuestionsPublished")).then((r) => r && setData(r))}>
              <Globe size={13} /> {t("studio.publishQuestions")}
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
            {STANDALONE_ANALYZE_STEP_KEYS.map((stepKey, i) => (
              <li key={stepKey} className={i < analyzeStep ? "done" : i === analyzeStep ? "active" : ""}>
                {i < analyzeStep ? <Check size={13} /> : <LoaderCircle size={13} className={i === analyzeStep ? "lw-studio__spin" : ""} />}
                {t(stepKey)}
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
          existingQuestions={data.questions}
          requireTimestamp={false}
        />
      )}

      {data.questions.length === 0 && suggestions.length === 0 && !formMode && (
        <div className="lw-empty">
          {editable ? t("studio.noQuestionsEditable") : t("studio.noQuestionsReadonly")}
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
          onSubmit={(answers) => api.previewStandaloneAssessment(session.token, slug, lessonId, answers)}
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
  const { t } = useLanguage();
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
    return <p className="muted" style={{ margin: 0, fontStyle: "italic" }}>{t("studio.reviewedForParticipation")}</p>;
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
  const { t } = useLanguage();
  return (
    <div className="lw-studio__unit">
      <div style={{ marginBottom: 8 }}>
        <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, s.type)}</span>
        {s.videoTimestampSeconds != null && <span className="lw-timestamp lw-tag">{formatTime(s.videoTimestampSeconds)}</span>}
      </div>
      <p className="lw-questioncard__prompt" style={{ fontSize: "0.92rem", margin: "0 0 10px" }}>{s.prompt}</p>
      <AnswerKeyDisplay type={s.type} options={s.options} correctOptionIndex={s.correctOptionIndex} acceptedAnswers={s.acceptedAnswers} />
      {s.explanation && <p className="lw-rationale"><Sparkles size={12} /> {s.explanation}</p>}
      <div className="lw-rowactions" style={{ marginTop: 12 }}>
        <button className="active" disabled={busy} aria-label={t("studio.accept")} onClick={() => onAccept(s)}><Check size={13} /></button>
        <button className="active danger" disabled={busy} aria-label={t("studio.removeSuggestion")} onClick={() => onReject(s.key)}><X size={13} /></button>
      </div>
    </div>
  );
}

function QuestionRow({ q, editable, onEdit, onRemove }) {
  const types = useQuestionTypes();
  const { t } = useLanguage();
  return (
    <div className="lw-studio__unit">
      <div style={{ marginBottom: 8 }}>
        <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, q.type)}</span>
        {q.videoTimestampSeconds != null && <span className="lw-timestamp lw-tag">{formatTime(q.videoTimestampSeconds)}</span>}
      </div>
      <p className="lw-questioncard__prompt" style={{ fontSize: "0.92rem", margin: "0 0 10px" }}>{q.prompt}</p>
      <AnswerKeyDisplay type={q.type} options={q.options} correctOptionIndex={q.correctOptionIndex} acceptedAnswers={q.acceptedAnswers} />
      {q.explanation && <p className="lw-rationale"><Sparkles size={12} /> {q.explanation}</p>}
      {editable && (
        <div className="lw-rowactions" style={{ marginTop: 12 }}>
          <button aria-label={t("studio.editQuestion")} onClick={() => onEdit(q)}><Pencil size={13} /></button>
          <button aria-label={t("studio.removeQuestion")} onClick={() => onRemove(q.id)}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  );
}

function QuestionForm({ initial, busy, onSave, onCancel, existingQuestions, videoDurationSeconds, requireTimestamp = true }) {
  const types = useQuestionTypes();
  const { t } = useLanguage();
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

  /** Switching type populates whatever that type requires, rather than leaving the previous type's data sitting unused underneath. */
  function selectType(next) {
    setType(next);
    if (next === "MultipleChoice") {
      if (options.filter((o) => o.trim()).length < 2) setOptions(["", ""]);
      if (correctOptionIndex < 0 || correctOptionIndex >= options.length) setCorrectOptionIndex(0);
    } else if (next === "TrueFalse") {
      setOptions(["True", "False"]);
      if (correctOptionIndex !== 0 && correctOptionIndex !== 1) setCorrectOptionIndex(0);
    } else if (next === "CompleteTheSentence") {
      if (acceptedAnswers.filter((a) => a.trim()).length === 0) setAcceptedAnswers([""]);
    }
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
    !prompt.trim() && t("studio.enterQuestionText"),
    type === "MultipleChoice" && options.filter((o) => o.trim()).length < 2 && t("studio.addAtLeast2Options"),
    type === "CompleteTheSentence" && !acceptedAnswers.some((a) => a.trim()) && t("studio.addAtLeastOneAcceptedAnswer"),
    requireTimestamp && String(timestamp).trim() === "" && t("studio.enterQuestionTime"),
    requireTimestamp && timestamp !== "" && videoDurationSeconds != null && Number(timestamp) >= videoDurationSeconds
      && t("studio.questionTimeLess"),
  ].filter(Boolean);
  const valid = validationMessages.length === 0;

  // Informational only — two questions at the same second is unusual, not
  // invalid, so this warns the tutor without blocking Save. Not applicable
  // when this form isn't timestamp-driven (the Standalone quiz).
  const sameTimeQuestion = requireTimestamp && timestamp !== "" && existingQuestions?.find(
    (q) => q.id !== initial?.id && Number(q.videoTimestampSeconds) === Number(timestamp));

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
          videoTimestampSeconds: !requireTimestamp || timestamp === "" ? null : Number(timestamp),
          points: Number(points) || 1,
        });
      }}
    >
      {attempted && validationMessages.length > 0 && (
        <Message type="error">
          {validationMessages.length === 1 ? validationMessages[0] : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {validationMessages.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </Message>
      )}

      <label>
        <span>{t("studio.type")}</span>
        <select value={type} onChange={(e) => selectType(e.target.value)} disabled={busy}>
          {types.map((qt) => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
        </select>
      </label>

      <label>
        <span>{t("studio.questionLabel")}<RequiredMark /></span>
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
                  placeholder={t("studio.optionPlaceholder", { n: i + 1 })} disabled={busy}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => removeOption(i)} aria-label={t("studio.removeOption")} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink-soft)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={addOption} disabled={busy} style={{ width: "fit-content" }}>
            <Plus size={12} /> {t("studio.addOption")}
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
          <p className="muted" style={{ margin: "0 0 4px" }}>{t("studio.anyPhraseCorrect")}</p>
          <div className="lw-options">
            {acceptedAnswers.map((a, i) => (
              <div key={i} className="lw-option" style={{ cursor: "default" }}>
                <input
                  style={{ flex: 1, border: 0, background: "transparent", font: "inherit", color: "inherit", outline: "none" }}
                  value={a} onChange={(e) => updateAcceptedAnswer(i, e.target.value)}
                  placeholder={t("studio.acceptedAnswerPlaceholder", { n: i + 1 })} disabled={busy}
                />
                {acceptedAnswers.length > 1 && (
                  <button type="button" onClick={() => removeAcceptedAnswer(i)} aria-label={t("studio.removeAcceptedAnswer")} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink-soft)" }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={addAcceptedAnswer} disabled={busy} style={{ width: "fit-content" }}>
            <Plus size={12} /> {t("studio.addAcceptedPhrasing")}
          </button>
        </>
      )}

      {type === "OpenAnswer" && (
        <p className="muted" style={{ margin: 0 }}>{t("studio.openAnswerNote")}</p>
      )}

      <label>
        <span>{type === "OpenAnswer" ? t("studio.guidance") : t("studio.explanation")} <em>{t("studio.shownAfterAnswering")}</em></span>
        <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} disabled={busy} />
      </label>

      {requireTimestamp && (
        <div className="lw-studio__minsfield">
          <span>{t("studio.questionTime")} <em>{t("studio.seconds")}</em><RequiredMark /></span>
          <input type="number" min="0" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} disabled={busy} required
                 style={attempted && (String(timestamp).trim() === "" || (videoDurationSeconds != null && Number(timestamp) >= videoDurationSeconds)) ? invalidFieldStyle : undefined} />
        </div>
      )}
      {sameTimeQuestion && (
        <div className="lw-studio__blocker">
          <AlertCircle size={14} />
          {t("studio.sameTimeWarning", { time: formatTime(Number(timestamp)) })}
        </div>
      )}
      <div className="lw-studio__minsfield">
        <span>{t("studio.points")}</span>
        <input type="number" min="1" value={points} onChange={(e) => setPoints(e.target.value)} disabled={busy} />
      </div>

      <div className="lw-studio__panelactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>{t("studio.cancel")}</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
          <Check size={13} /> {t("studio.saveQuestion")}
        </button>
      </div>
    </form>
  );
}

function PreviewPanel({ questions, onClose, onSubmit }) {
  const types = useQuestionTypes();
  const { t } = useLanguage();
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
        <button className="lw-studio__panelclose" onClick={onClose} aria-label={t("studio.close")}><X size={16} /></button>
        <div className="lw-eyebrow">{t("studio.previewEyebrow")}</div>
        <h2 className="lw-studio__panelh2">{t("studio.previewTitle")}</h2>

        {error && <Message type="error">{error}</Message>}

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
                placeholder={q.type === "CompleteTheSentence" ? t("studio.yourAnswerPlaceholder") : t("studio.yourResponsePlaceholder")}
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
                ? <><LoaderCircle size={13} className="lw-studio__spin" /> {t("studio.aiGrading")}</>
                : <><Bot size={13} /> {t("studio.submitForGrading")}</>}
            </button>
          </div>
        )}

        {result && (
          <div className="lw-aicard" style={{ marginTop: 18, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Bot size={16} />
              <div className="lw-aicard__body">
                <strong>{result.passed ? t("studio.passed") : t("studio.notYetPassing")} — {result.scorePercent}%</strong>
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
                      {reviewed ? t("studio.reviewedNotScored") : pq?.correct ? t("studio.correct") : t("studio.correctAnswerIs", { answer: pq?.correctAnswerDisplay ?? t("studio.notAvailable") })}
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
    list-style: none; counter-reset: lw-step; text-align: start;
    max-width: 44ch; margin: 4px auto 0; padding: 0; display: flex; flex-direction: column; gap: 10px;
  }
  .lw-studio__steps li {
    counter-increment: lw-step; position: relative; padding-inline-start: 30px;
    font-size: 0.86rem; color: var(--ink-soft); line-height: 1.5;
  }
  .lw-studio__steps li::before {
    content: counter(lw-step); position: absolute; inset-inline-start: 0; top: -1px;
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
  .lw-studio__unitactions button:disabled { opacity: 0.35; cursor: not-allowed; }
  .lw-studio__renameform { display: flex; gap: 6px; align-items: center; flex: 1; }
  .lw-studio__renameform input {
    flex: 1; font-family: var(--font-display); font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--accent); border-radius: 6px; padding: 5px 9px; background: var(--bg); color: var(--ink);
  }
  .lw-studio__renameform button { background: transparent; border: none; color: var(--accent); cursor: pointer; display: flex; }

  .lw-studio__unitempty { font-size: 0.82rem; color: var(--ink-soft); font-style: italic; padding: 6px 0 10px; }

  .lw-studio__lessonlist { display: flex; flex-direction: column; gap: 6px; }
  .lw-studio__lessonrow { display: flex; align-items: center; gap: 4px; }
  .lw-studio__lessonmove { display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
  .lw-studio__lessonmove button {
    background: transparent; border: 1px solid var(--line); border-radius: 4px;
    color: var(--ink-soft); cursor: pointer; padding: 1px; display: flex;
  }
  .lw-studio__lessonmove button:hover { color: var(--ink); }
  .lw-studio__lessonmove button:disabled { opacity: 0.35; cursor: not-allowed; }
  .lw-studio__lessonopen {
    flex: 1; display: flex; align-items: center; gap: 9px; text-align: start;
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
    display: flex; flex-direction: column; text-align: start; cursor: pointer; padding: 0;
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
    position: absolute; top: 9px; inset-inline-end: 9px; background: rgba(10,12,15,0.4); color: #fff;
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
  .lw-studio__panelclose { position: absolute; top: 18px; inset-inline-end: 18px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
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
  .lw-studio__draftform > .lw-studio__blocker,
  .lw-studio__draftform > p,
  .lw-studio__draftform > .lw-options,
  .lw-studio__draftform > button,
  .lw-studio__draftform > .lw-studio__panelactions {
    grid-column: 1 / -1;
  }
  .lw-studio__minsfield input { max-width: 120px; }
  .lw-studio__panelactions { display: flex; justify-content: flex-end; gap: 8px; }
  .lw-studio__fielderror { display: block; color: var(--danger); font-size: 0.78rem; margin-top: 4px; }
  .lw-studio__contentlabel { display: flex !important; align-items: center; gap: 8px; white-space: normal !important; }
  .lw-btn--xs { font-size: 0.72rem; padding: 3px 8px; gap: 4px; }
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
  .lw-studio__versionoption ul { margin: 0; padding-inline-start: 18px; font-size: 0.78rem; color: var(--ink-soft); line-height: 1.6; flex: 1; }
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
