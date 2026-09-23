import { useCallback, useEffect, useRef, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, ArrowLeft, X, Trash2, Eye,
  Globe, Undo2, Archive, Layers, FileText, Pencil, Check, BookOpen,
  UploadCloud, Sparkles, Bot, PlayCircle, Link as LinkIcon, ChevronUp, ChevronDown,
  ClipboardCheck, Paperclip, Download, ClipboardList, SlidersHorizontal, Target,
  ListChecks, Send, CalendarClock, RotateCcw,
} from "lucide-react";
import * as api from "../api/client";
import AssetImage from "../components/AssetImage";
import { useAuth } from "../auth/authContext";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";
import Message from "../components/Message";
import Notice from "../components/Notice";
import InfoTip from "../components/InfoTip";
import TutorTip from "../components/TutorTip";
import Modal, { MODAL_CSS } from "../components/Modal";
import VideoPlayer from "../components/VideoPlayer";
import AssetLink from "../components/AssetLink";
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
  //
  // Which product's curriculum to open is picked from the card grid first
  // (ProductPicker) — that's also where structural curriculum work
  // (adding/reordering units and lessons, publishing) lives, via the tree.
  // A tutor who already knows exactly which lesson they want skips straight
  // to the Course/Unit/Lesson dropdown editor instead, via its own
  // "Edit lesson" entry in the sidebar nav (see LessonEditorScreen, exported
  // below and rendered directly by App.jsx — not reached through this
  // component at all).
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
        <Notice tone="empty" icon={BookOpen} title={t("studio.noProductsTitle")}>
          <p>{t("studio.noProductsBody")}</p>
        </Notice>
      )}

      <div className="lw-studio__productgrid">
        {data.products.map((p) => (
          <button className="lw-studio__card" key={p.id} onClick={() => onSelect(p.id)}>
            <div className={`lw-studio__cardcover ${p.coverImageAssetId ? "" : `lw-cover--${coverVariant(p.id)}`}`}>
              {p.coverImageAssetId ? (
                <AssetImage batch className="lw-studio__cardcoverimg" alt="" token={session?.token} slug={slug} assetId={p.coverImageAssetId} />
              ) : (
                <span className="lw-studio__cardmonogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
              )}
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

  // A lesson is being edited — that's now a full page of its own (with its
  // own product/unit/lesson pickers for jumping straight to any other
  // lesson) rather than an overlay stacked on top of this tree.
  if (openLessonId) {
    return (
      <LessonEditorScreen
        key={openLessonId}
        initialProductId={productId}
        initialLessonId={openLessonId}
        onBack={() => setOpenLessonId(null)}
        onChanged={load}
      />
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
        <Notice tone="empty" icon={Layers} title={editable ? t("studio.buildTitle") : t("studio.noUnitsTitle")}>
          {editable ? (
            <ol className="lw-studio__steps">
              <li><strong>{t("studio.stepAddUnit")}</strong> {t("studio.stepAddUnitRest")}</li>
              <li><strong>{t("studio.stepAddLessons")}</strong> {t("studio.stepAddLessonsRest")}</li>
              <li><strong>{t("studio.stepOpenLesson")}</strong> {t("studio.stepOpenLessonRest")}</li>
            </ol>
          ) : (
            <p>{t("studio.noUnitsBody")}</p>
          )}
        </Notice>
      )}

      <div className="lw-studio__units">
        {data.units.map((u, i) => (
          <UnitCard
            key={u.id} unit={u} editable={editable} busy={busy}
            isFirst={i === 0} isLast={i === data.units.length - 1}
            unplacedLessons={data.unplacedLessons}
            onOpenLesson={setOpenLessonId}
            onRename={(title) => run(() => api.renameUnit(session.token, slug, productId, u.id, title), t("studio.toastUnitRenamed", { title })).then(load)}
            onRemove={() => {
              if (!window.confirm(t("studio.confirmRemoveUnit", { title: u.title }))) return;
              run(() => api.removeUnit(session.token, slug, productId, u.id), t("studio.toastUnitRemoved", { title: u.title })).then(load);
            }}
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

      {!data.canAuthor && <Notice tone="readonly">{t("studio.readonlyNote")}</Notice>}
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

/* ── Step 3: edit one lesson ──────────────────────────────────────────
   A full page rather than an overlay on top of the curriculum tree, so
   there's real room for the lesson's tabs. Three cascading dropdowns —
   product, then unit, then lesson — let a tutor jump straight to any
   lesson in the workspace without ever opening the tree. Reached either by
   clicking a lesson in the tree (CurriculumBuilder passes in the
   product/lesson it was opened from, plus onBack to return there) or,
   standalone, as the sidebar's own "Edit lesson" nav item (App.jsx renders
   this directly with no props at all — no onBack, since there's no picker
   to return to; see backLabel for the tree-click case's wording).
   ========================================================================= */

const UNPLACED_UNIT = "__unplaced__";

export function LessonEditorScreen({ initialProductId, initialLessonId, onBack, onChanged, backLabel = "studio.backToCurriculum" }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [products, setProducts] = useState(null);
  const [productsError, setProductsError] = useState(null);
  const [productId, setProductId] = useState(initialProductId ?? null);

  useEffect(() => {
    let cancelled = false;
    api.getProducts(session.token, slug)
      .then((d) => { if (!cancelled) { setProducts(d.products); setProductsError(null); } })
      .catch((e) => { if (!cancelled) setProductsError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      {onBack && (
        <button className="lw-studio__back" onClick={onBack}>
          <ArrowLeft size={13} /> {t(backLabel)}
        </button>
      )}

      <div className="lw-eyebrow">{t("studio.lessonEyebrow")}</div>
      <h1>{t("studio.pickLessonTitle")}</h1>
      <p className="lw-sub">{t("studio.pickLessonLead")}</p>

      {productsError && <Message type="error">{productsError}</Message>}

      <div className="lw-studio__picker">
        <label>
          <span>{t("studio.pickProductLabel")}</span>
          <select
            value={productId ?? ""} disabled={!products}
            onChange={(e) => setProductId(e.target.value || null)}
          >
            <option value="" disabled>{t("studio.pickProductPlaceholder")}</option>
            {(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>

        {productId && (
          <LessonPicker
            key={productId}
            productId={productId}
            initialLessonId={productId === initialProductId ? initialLessonId : null}
            onChanged={onChanged}
          />
        )}
      </div>

      {!productId && (
        <Notice tone="empty">{t("studio.pickProductFirst")}</Notice>
      )}
    </div>
  );
}

/**
 * Owns the unit/lesson dropdowns and the lesson editor content for one
 * product. Remounted (via the parent's key={productId}) whenever the
 * product dropdown changes, so a stale unit/lesson selection from a
 * different product can never linger — same remount-instead-of-reset-effect
 * convention ContentStudioScreen already uses for productId itself.
 */
function LessonPicker({ productId, initialLessonId, onChanged }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [curriculum, setCurriculum] = useState(null);
  const [error, setError] = useState(null);
  const [unitId, setUnitId] = useState(null);
  const [lessonId, setLessonId] = useState(initialLessonId);
  const [busy, setBusy] = useState(false);
  // Kept separate from `error` (which, if set, blanks the whole picker below —
  // appropriate for a failed initial load, not for a failed button click that
  // should leave the dropdowns/lesson content right where they were).
  const [actionError, setActionError] = useState(null);

  const load = useCallback(
    () => api.getCurriculum(session.token, slug, productId)
      .then((d) => { setCurriculum(d); setError(null); return d; })
      .catch((e) => { setError(e.message); return null; }),
    [session.token, slug, productId]);

  // Same action as the curriculum tree's own "Edit Mode" button (CurriculumBuilder,
  // above) — surfaced here too, since a tutor who came straight from "Edit lesson"
  // would otherwise have no way to leave view-only mode without navigating away
  // to the tree first just to unpublish, then coming back.
  async function handleEditMode() {
    setBusy(true);
    setActionError(null);
    try {
      await api.curriculumTransition(session.token, slug, productId, "unpublish");
      await load();
    } catch (e) { setActionError(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    load().then((d) => {
      if (cancelled || !d) return;
      setUnitId(unitContaining(d, initialLessonId));
    });
    return () => { cancelled = true; };
    // Runs once per mount (i.e. once per productId, via the parent's key) —
    // initialLessonId should only ever seed the very first resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <Message type="error">{error}</Message>;

  if (!curriculum) {
    return (
      <div className="lw-studio__loading"><LoaderCircle size={18} className="lw-studio__spin" /> {t("studio.loading")}</div>
    );
  }

  const unitOptions = [
    ...curriculum.units.map((u) => ({ id: u.id, title: u.title, lessons: u.lessons })),
    ...(curriculum.unplacedLessons.length > 0
      ? [{ id: UNPLACED_UNIT, title: t("studio.notInUnit"), lessons: curriculum.unplacedLessons }]
      : []),
  ];
  const lessons = unitOptions.find((u) => u.id === unitId)?.lessons ?? [];
  const editable = curriculum.canAuthor && curriculum.status !== "Published" && curriculum.status !== "Archived";

  return (
    <>
      <label>
        <span>{t("studio.pickUnitLabel")}</span>
        <select
          value={unitId ?? ""} disabled={unitOptions.length === 0}
          onChange={(e) => { setUnitId(e.target.value || null); setLessonId(null); }}
        >
          <option value="" disabled>{t("studio.pickUnitPlaceholder")}</option>
          {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
        </select>
      </label>

      <label>
        <span>{t("studio.pickLessonLabel")}</span>
        <select
          value={lessonId ?? ""} disabled={!unitId || lessons.length === 0}
          onChange={(e) => setLessonId(e.target.value || null)}
        >
          <option value="" disabled>{t("studio.pickLessonPlaceholder")}</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </label>

      {curriculum.canAuthor && curriculum.status === "Published" && (
        <div className="lw-studio__pickeredit" style={{ gridColumn: "1 / -1" }}>
          {actionError && <Message type="error">{actionError}</Message>}
          <div className="lw-studio__bar">
            <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={handleEditMode}>
              <Undo2 size={13} /> {t("studio.editMode")}
            </button>
          </div>
          <p className="muted">
            {t("studio.publishedNoticePrefix")} <strong>{t("studio.editMode")}</strong> {t("studio.publishedNoticeSuffix")}
          </p>
        </div>
      )}

      {unitOptions.length === 0 && (
        <Notice tone="empty" style={{ gridColumn: "1 / -1" }}>{t("studio.noLessonsInProduct")}</Notice>
      )}

      {lessonId ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <LessonEditorContent
            key={lessonId}
            lessonId={lessonId}
            editable={editable}
            onChanged={() => { load(); onChanged?.(); }}
            onDuplicated={(newId) => { setUnitId(UNPLACED_UNIT); setLessonId(newId); }}
          />
        </div>
      ) : (
        unitOptions.length > 0 && (
          <Notice tone="empty" style={{ gridColumn: "1 / -1" }}>{t("studio.pickLessonFirst")}</Notice>
        )
      )}
    </>
  );
}

function unitContaining(curriculum, lessonId) {
  if (!lessonId) return null;
  const unit = curriculum.units.find((u) => u.lessons.some((l) => l.id === lessonId));
  if (unit) return unit.id;
  if (curriculum.unplacedLessons.some((l) => l.id === lessonId)) return UNPLACED_UNIT;
  return null;
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

function LessonEditorContent({ lessonId, editable, onChanged, onDuplicated }) {
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
  const [transcript, setTranscript] = useState("");
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
    // Matches the backend's own guard (ContentStudioService.SuggestTitleAsync):
    // a title can be drafted from either the body or a Ready transcript, so
    // this must not require body specifically — a video-only lesson with no
    // written body yet is a normal workflow, not a blocked one.
    if (!body.trim() && !transcript.trim()) { setActiveTab("content"); return; }
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

  // PDF & Image Lesson Content Extraction, EXT-005 — one click can fill up
  // to five fields at once, so unlike every single-field Suggest button
  // above (which always overwrites on click), this only fills a field that
  // is currently empty. A field the tutor already started is left
  // untouched; its own Suggest button next to it still overwrites on
  // request, unaffected by this restriction. Owned here (not inside
  // ResourcesSection, where the button lives) because filling these fields
  // means touching this component's own state.
  const [aiExtractBusyId, setAiExtractBusyId] = useState(null);

  // PDF & Image Lesson Content Extraction §9 — a lesson built entirely from
  // a PDF can't actually publish as Recorded (needs a video) or LiveSession
  // (implies a scheduled class). A suggestion only, never applied
  // automatically — AIA-004's non-destructive principle: extraction filling
  // text fields is not license to change the tutor's delivery mode for them.
  const [showReadingModeHint, setShowReadingModeHint] = useState(false);

  // Shared by the AI-read (extractResourceContent) and manual-paste
  // (structurePastedContent) paths below — both return the same five-field
  // shape and apply with the same fill-only-if-empty rule (EXT-005).
  function applyExtractedFields(r) {
    const found = Boolean(r.title || r.body || r.whatYoullLearn || r.learningObjectives || r.glossary);
    let filled = false;
    if (r.title && !title.trim()) { setTitle(r.title); filled = true; }
    if (r.body && !body.trim()) { setBody(r.body); filled = true; }
    if (r.whatYoullLearn && !whatYoullLearn.trim()) { setWhatYoullLearn(r.whatYoullLearn); filled = true; }
    if (r.learningObjectives && !learningObjectives.trim()) { setLearningObjectives(r.learningObjectives); filled = true; }
    if (r.glossary && !glossary.trim()) { setGlossary(r.glossary); filled = true; }
    if (!found) return { status: "empty" };
    if (filled && deliveryMode === "Recorded" && !hasVideoNow) setShowReadingModeHint(true);
    return { status: filled ? "filled" : "skipped" };
  }

  async function handleExtractResource(resourceId) {
    setAiExtractBusyId(resourceId);
    try {
      const r = await api.extractResourceContent(session.token, slug, lessonId, resourceId);
      return applyExtractedFields(r);
    } finally {
      setAiExtractBusyId(null);
    }
  }

  // Manual-entry fallback (e.g. the AI provider can't read files directly,
  // or the tutor just has the text handy already) — same fill rule, just
  // sourced from pasted text instead of an uploaded file.
  const [structuringPastedContent, setStructuringPastedContent] = useState(false);

  async function handleStructurePastedContent(text) {
    setStructuringPastedContent(true);
    try {
      const r = await api.structurePastedContent(session.token, slug, lessonId, text);
      return applyExtractedFields(r);
    } finally {
      setStructuringPastedContent(false);
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
      setTranscript(source?.transcript ?? "");
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
      transcript: transcript.trim() || null,
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
    if (!title.trim() || !body.trim()) { setActiveTab("content"); setAttempted(true); return; }
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
   * on this same editor, lands on whichever tab triggered the dialog (video/
   * delivery-mode changes land on Delivery so the new video can be uploaded
   * right away; an activity add/edit lands back on Activities) — nothing
   * navigates away. If the dialog was opened from the delivery-type select,
   * the chosen mode is applied to the fresh draft immediately, since a real
   * draft now exists to save it onto.
   */
  async function confirmSameLessonNewVersion() {
    const trigger = versionDialogTrigger;
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
    setActiveTab(trigger === "activity" ? "activities" : "delivery");
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

  const revisionForVideoCheck = lesson?.draftRevision ?? lesson?.currentRevision;
  const hasVideoNow = !!revisionForVideoCheck?.video || !!revisionForVideoCheck?.videoUrl;
  const requireQuizToComplete = !!revisionForVideoCheck?.requireQuizToComplete;

  function handleToggleRequireQuizToComplete(next) {
    run(() => api.setLessonRequireQuizToComplete(session.token, slug, lessonId, next))
      .then((l) => l && setLesson(l));
  }

  return (
    <>
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
              <button type="button" className={activeTab === "homework" ? "active" : ""} onClick={() => setActiveTab("homework")}>
                <ClipboardList size={13} /> {t("studio.tabHomework")}
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
              <button type="button" className={activeTab === "activities" ? "active" : ""} onClick={() => setActiveTab("activities")}>
                <ListChecks size={13} /> {t("studio.tabActivities")}
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
                              disabled={busy || aiTitleBusy || (!body.trim() && !transcript.trim())} title={t("studio.aiSuggestTitle")}>
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
                  <textarea rows={3} value={whatYoullLearn} onChange={(e) => setWhatYoullLearn(e.target.value)} placeholder={t("studio.whatYoullLearnPlaceholder")} disabled={busy || !editable} className={editable ? "editable" : ""} />
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
                  <textarea rows={4} value={learningObjectives} onChange={(e) => setLearningObjectives(e.target.value)} placeholder={t("studio.learningObjectivesPlaceholder") } disabled={busy || !editable} className={editable ? "editable" : ""} />
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
                  <textarea rows={4} value={glossary} onChange={(e) => setGlossary(e.target.value)} placeholder={t("studio.glossaryPlaceholder")} disabled={busy || !editable} className={editable ? "editable" : ""} />
                  {aiGlossaryError && <Message type="error">{aiGlossaryError}</Message>}
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
                  <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("studio.contentPlaceholder")} disabled={busy || !editable} className={editable ? "editable" : ""} style={publishAttempted && !body.trim() ? invalidFieldStyle : undefined} />
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
                              disabled={busy || aiTitleBusy || (!body.trim() && !transcript.trim())} title={t("studio.aiSuggestTitle")}>
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
                  <p className="muted" style={{ margin: 0 }}>
                    {t("studio.publishedDirectNotePrefix")} <strong>{t("studio.publishedDirectNoteBold")}</strong> {t("studio.publishedDirectNoteSuffix")}
                  </p>
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

            {activeTab === "homework" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <div className="lw-studio__draftform">
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
                    <textarea rows={8} value={homework} onChange={(e) => setHomework(e.target.value)}
                              placeholder={t("studio.homeworkPlaceholder")}
                              disabled={busy || !editable} className={editable ? "editable" : ""} />
                    {aiHomeworkError && <Message type="error">{aiHomeworkError}</Message>}
                  </label>
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForHomework")}</p>
              )
            )}

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
                        <option value="Reading">{t("studio.readingLesson")}</option>
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
                    transcript={transcript}
                    setTranscript={setTranscript}
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
                <>
                  <label className="lw-studio__requirequiz">
                    <input
                      type="checkbox" checked={requireQuizToComplete} disabled={busy || !editable}
                      onChange={(e) => handleToggleRequireQuizToComplete(e.target.checked)}
                    />
                    <span>
                      {t("studio.requireQuizToComplete")}
                      <InfoTip text={t("studio.requireQuizToCompleteHint")} />
                    </span>
                  </label>
                  <StandaloneAssessmentSection lessonId={lesson.id} editable={editable} />
                </>
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForQuestions")}</p>
              )
            )}

            {activeTab === "resources" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <>
                  {showReadingModeHint && deliveryMode === "Recorded" && !hasVideoNow && (
                    <Message type="success">{t("studio.considerReadingMode")}</Message>
                  )}
                  <ResourcesSection
                    lesson={lesson}
                    editable={editable}
                    onChanged={load}
                    onExtract={handleExtractResource}
                    extractBusyId={aiExtractBusyId}
                    onStructurePastedContent={handleStructurePastedContent}
                    structuringPastedContent={structuringPastedContent}
                  />
                </>
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForResources")}</p>
              )
            )}

            {activeTab === "activities" && (
              (lesson.currentRevision || lesson.draftRevision) ? (
                <LearningActivitiesSection
                  lesson={lesson} editable={editable} onChanged={load}
                  onRequestNewVersion={() => setVersionDialogTrigger("activity")}
                />
              ) : (
                <p className="muted" style={{ marginTop: 14 }}>{t("studio.startRevisionForActivities")}</p>
              )
            )}

            {editable && (
              <div className="lw-studio__panelfooter">
                {!lesson.draftRevision && lesson.currentRevision && (
                  <button type="button" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy} onClick={handleQuickSave}>
                    {t("studio.saveChanges")}
                  </button>
                )}
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
                {/* Unpublished, no pending draft — the same revision that was
                    live is still sitting on CurrentRevision (Unpublish never
                    touches it), so bringing it back needs no new draft, just
                    the status flipped back via Lesson.Republish. */}
                {!lesson.draftRevision && lesson.status === "Draft" && lesson.currentRevision && (
                  <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}
                          onClick={() => run(() => api.lessonTransition(session.token, slug, lessonId, "republish"), t("studio.toastLessonPublished")).then((l) => l && setLesson(l))}>
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
    </>
  );
}

/**
 * Lesson Editing & Publication UX, Scenario 5's "Replace Video Dialog" —
 * shown before any Major-classified change on a published lesson (replacing
 * the video, changing delivery mode, or — same underlying rule, Learning
 * Activity Assignment BA §8 — adding/editing a Learning Activity), since all
 * of these start a new version. Every trigger shares the same two backend
 * actions (a new draft of this same lesson, carried forward; or a genuinely
 * separate duplicate lesson); only the heading/explanation and which tab the
 * tutor lands on afterward differ per trigger.
 */
const VERSION_DIALOG_COPY = {
  video: { title: "studio.replacingVideoTitle", note: "studio.replacingVideoNote", li2: "studio.newVersionLi2" },
  delivery: { title: "studio.changingDeliveryTitle", note: "studio.changingDeliveryNote", li2: "studio.newVersionLi2" },
  activity: { title: "studio.editingActivityTitle", note: "studio.editingActivityNote", li2: "studio.newVersionLi2Activity" },
};

function ReplaceVersionDialog({ trigger, busy, onCancel, onChooseNewVersion, onChooseNewDraft }) {
  const { t } = useLanguage();
  const copy = VERSION_DIALOG_COPY[trigger] ?? VERSION_DIALOG_COPY.video;
  return (
    <div className="lw-studio__overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="lw-studio__panel" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <button className="lw-studio__panelclose" onClick={onCancel} aria-label={t("studio.close")}><X size={16} /></button>
        <div className="lw-eyebrow">{t("studio.newVersionEyebrow")}</div>
        <h2 className="lw-studio__panelh2">{t(copy.title)}</h2>
        <Notice tone="warning" style={{ marginBottom: 16 }}>{t(copy.note)}</Notice>

        <div className="lw-studio__versionoptions">
          <div className="lw-studio__versionoption">
            <h3>{t("studio.createNewVersion")}</h3>
            <ul>
              <li>{t("studio.newVersionLi1")}</li>
              <li>{t(copy.li2)}</li>
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

/** Matches LearningAssetService.MaxResourceBytes on the backend. */
const MAX_VIDEO_BYTES = 500_000_000;

const ENHANCEMENT_BADGE_STYLE = {
  None: null,
  Processing: { background: "var(--surface-2, #eee)", color: "var(--ink-soft, #666)" },
  Ready: { background: "#E5F3EA", color: "#1E7D61" },
  ReviewRequired: { background: "#F0C040", color: "#4A3A00" },
  Failed: { background: "color-mix(in srgb, var(--danger, #C0392B) 15%, transparent)", color: "var(--danger, #C0392B)" },
};

function EnhancementStatusBadge({ status, t }) {
  const style = ENHANCEMENT_BADGE_STYLE[status];
  if (!style) return null;
  return (
    <span style={{ ...style, borderRadius: 999, padding: "1px 8px", fontSize: "0.68rem", fontWeight: 600 }}>
      {t(`studio.enhanceStatus${status}`)}
    </span>
  );
}

/** Defensive JSON.parse — the server sends this as a raw string; a parse failure here (unexpected shape, null) just hides the detail list rather than crashing the transcript panel. */
function EnhancementReviewItems({ json, t }) {
  let items;
  try { items = json ? JSON.parse(json) : null; } catch { items = null; }
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={item.segmentId ?? i} style={{ marginBottom: 4 }}>
          <strong>{item.issue ?? t("studio.enhanceReviewItemFallback")}</strong>
          {item.originalText && <> — "{item.originalText}"</>}
          {item.reason && <div className="muted" style={{ fontSize: "0.75rem" }}>{item.reason}</div>}
        </li>
      ))}
    </ul>
  );
}

function VideoSection({ lesson, editable, hasDraft, deliveryMode, publishAttempted, onChanged, onDurationKnown, onRequestNewVersion, transcript, setTranscript }) {
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

  // AI Video Transcript — an uploaded video or a direct-file video URL can be
  // transcribed; a YouTube link is rejected server-side (no direct file to
  // download). Poll while Processing since the real work happens on a
  // background job, not this request.
  const transcriptStatus = revision?.transcriptStatus ?? "None";
  const transcriptSource = revision?.transcriptSource ?? "None";
  const [transcriptError, setTranscriptError] = useState(null);
  const [startingTranscript, setStartingTranscript] = useState(false);
  // Automatic language detection has been observed to confidently pick the
  // wrong language on a real, heavily code-switched lesson video (mostly
  // Arabic, transcribed almost entirely in English) — letting the tutor pin
  // it here is more reliable than trusting the guess.
  const [transcriptLanguage, setTranscriptLanguage] = useState("auto");

  // AI Transcript Enhancement — a conservative, tutor-triggered ASR-error
  // correction pass over the already-Ready raw transcript above. Entirely
  // separate lifecycle: the raw Transcript field is never touched, and
  // enhancementStatus/enhancedTranscript are independent server fields. Same
  // "start job, poll while Processing" shape as transcript generation itself.
  const enhancementStatus = revision?.enhancementStatus ?? "None";
  const [enhanceError, setEnhanceError] = useState(null);
  const [startingEnhancement, setStartingEnhancement] = useState(false);
  const [confirmingEnhance, setConfirmingEnhance] = useState(false);
  // Defaults to "enhanced" only when one already existed when this screen
  // was first opened (e.g. returning to an already-enhanced lesson) — a
  // lazy initializer, not an effect, so a new enhancement completing later
  // in the same session never yanks the view out from under a tutor who's
  // mid-read of the raw text; they switch manually via the buttons below.
  const [transcriptView, setTranscriptView] = useState(() =>
    revision?.enhancementStatus === "Ready" || revision?.enhancementStatus === "ReviewRequired" ? "enhanced" : "raw");

  useEffect(() => {
    if (transcriptStatus !== "Processing" && enhancementStatus !== "Processing") return;
    const id = setInterval(() => { onChanged(); }, 5000);
    return () => clearInterval(id);
  }, [transcriptStatus, enhancementStatus, onChanged]);

  async function handleGenerateTranscript() {
    setTranscriptError(null);
    setStartingTranscript(true);
    try {
      await api.generateLessonTranscript(session.token, slug, lesson.id, transcriptLanguage);
      onChanged();
    } catch (e) {
      setTranscriptError(e.message);
    } finally {
      setStartingTranscript(false);
    }
  }

  async function handleEnhanceTranscript() {
    setConfirmingEnhance(false);
    setEnhanceError(null);
    setStartingEnhancement(true);
    try {
      await api.enhanceLessonTranscript(session.token, slug, lesson.id);
      onChanged();
    } catch (e) {
      setEnhanceError(e.message);
    } finally {
      setStartingEnhancement(false);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    // Matches LearningAssetService.MaxResourceBytes — fails fast instead of
    // spending minutes uploading a file the server was always going to reject.
    if (file.size > MAX_VIDEO_BYTES) {
      setError(t("studio.videoTooLarge"));
      return;
    }
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
    if (!window.confirm(t("studio.confirmRemoveVideo"))) return;
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
  const isReading = deliveryMode === "Reading";
  // Reading, like LiveSession, doesn't require a video to publish (§9) — but
  // deliberately doesn't reuse LiveSession's "recording" framing (title,
  // hint copy): a reading lesson never expects a recording of anything.
  const videoOptional = isLive || isReading;

  return (
    <div className="lw-studio__section">
      <h2 className="lw-sectiontitle">{isLive ? t("studio.recordingTitle") : t("studio.videoTitle")}</h2>
      {isLive && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{t("studio.liveNote")}</p>
      )}
      {isReading && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{t("studio.readingVideoNote")}</p>
      )}
      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}
      {!videoOptional && !hasVideo && publishAttempted && (
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
                <span className="lw-dropzone__title">
                  {isLive ? t("studio.uploadRecordingOptional") : isReading ? t("studio.uploadVideoOptionalReading") : t("studio.uploadLessonVideo")}
                </span>
                <span className="lw-dropzone__meta">
                  {isLive ? t("studio.recordingHint") : isReading ? t("studio.videoOptionalReadingHint") : t("studio.videoHint")}
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
            <VideoPlayer
              key={video.id}
              assetAccess={{ token: session?.token, slug, assetId: video.id }}
              controls
              style={{ width: "100%", height: "100%" }}
              onDurationChange={(sec) => onDurationKnown(Math.round(sec))}
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
        </div>
      )}

      {videoUrl && (
        <div className="lw-player">
          <div className="lw-player__frame">
            <VideoPlayer
              key={videoUrl}
              src={videoUrl}
              controls
              style={{ width: "100%", height: "100%" }}
              onDurationChange={(sec) => onDurationKnown(Math.round(sec))}
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

      {hasVideo && (
        <div className="lw-transcript" style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
          {transcriptError && <Message type="error">{transcriptError}</Message>}

          {editable ? (
            <details open>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  Transcript
                  {transcriptSource !== "None" && (
                    <span className="muted" style={{ marginLeft: 8, fontWeight: "normal", fontSize: "0.75rem" }}>
                      ({transcriptSource})
                    </span>
                  )}
                </span>
                {transcriptStatus !== "Processing" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select
                      value={transcriptLanguage}
                      disabled={startingTranscript || !hasVideo}
                      onChange={(e) => setTranscriptLanguage(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      title={t("studio.transcriptLanguageHint")}
                      style={{ fontSize: "0.78rem", padding: "3px 6px" }}
                    >
                      <option value="auto">{t("studio.transcriptLanguageAuto")}</option>
                      <option value="ar">{t("studio.transcriptLanguageArabic")}</option>
                      <option value="en">{t("studio.transcriptLanguageEnglish")}</option>
                    </select>
                    <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={startingTranscript || !hasVideo} onClick={(e) => { e.preventDefault(); handleGenerateTranscript(); }} title={!hasVideo ? "Upload a video first" : ""}>
                      {startingTranscript ? <LoaderCircle size={13} className="lw-studio__spin" /> : <Sparkles size={13} />} {t(transcriptStatus === "Failed" ? "studio.retryTranscript" : "studio.generateTranscript")}
                    </button>
                  </span>
                )}
                {transcriptStatus === "Processing" && (
                  <span className="muted" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4 }}>
                    <LoaderCircle size={13} className="lw-studio__spin" /> {t("studio.transcriptProcessing")}
                  </span>
                )}
              </summary>
              {transcriptStatus === "Failed" && (
                <div style={{ marginTop: 8 }}>
                  <Message type="error">{revision.transcriptError ?? t("studio.transcriptFailed")}</Message>
                </div>
              )}
              <textarea
                rows={8}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                disabled={transcriptStatus === "Processing"}
                placeholder="Enter or edit the lesson transcript here..."
                style={{ width: "100%", marginTop: 8, fontFamily: "monospace", fontSize: "13px" }}
              />

              {enhanceError && <Message type="error">{enhanceError}</Message>}

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem" }}>
                    <Sparkles size={13} />
                    <strong>{t("studio.enhanceTranscriptLabel")}</strong>
                    <EnhancementStatusBadge status={enhancementStatus} t={t} />
                  </span>

                  {!confirmingEnhance ? (
                    <button
                      className="lw-btn lw-btn--ghost lw-btn--xs"
                      disabled={transcriptStatus !== "Ready" || startingEnhancement || enhancementStatus === "Processing"}
                      onClick={() => setConfirmingEnhance(true)}
                      title={transcriptStatus !== "Ready" ? t("studio.enhanceTranscriptNeedsRawTranscript") : ""}
                    >
                      {enhancementStatus === "Processing" ? (
                        <><LoaderCircle size={13} className="lw-studio__spin" /> {t("studio.enhanceTranscriptEnhancing")}</>
                      ) : (
                        <>
                          <Sparkles size={13} />{" "}
                          {t(enhancementStatus === "None" ? "studio.enhanceTranscriptEnhance" : "studio.enhanceTranscriptEnhanceAgain")}
                        </>
                      )}
                    </button>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="muted" style={{ fontSize: "0.78rem" }}>{t("studio.enhanceTranscriptConfirm")}</span>
                      <button className="lw-btn lw-btn--primary lw-btn--xs" disabled={startingEnhancement} onClick={handleEnhanceTranscript}>
                        {startingEnhancement ? <LoaderCircle size={13} className="lw-studio__spin" /> : t("studio.enhanceTranscriptConfirmYes")}
                      </button>
                      <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={startingEnhancement} onClick={() => setConfirmingEnhance(false)}>
                        {t("studio.enhanceTranscriptConfirmNo")}
                      </button>
                    </span>
                  )}
                </div>

                {enhancementStatus === "Failed" && (
                  <div style={{ marginTop: 8 }}>
                    <Message type="error">{revision.enhancementError ?? t("studio.enhanceTranscriptFailedMessage")}</Message>
                  </div>
                )}

                {(enhancementStatus === "Ready" || enhancementStatus === "ReviewRequired") && revision.enhancedTranscript && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 6 }}>
                      {["raw", "enhanced", "compare"].map((view) => (
                        <button
                          key={view}
                          className={`lw-btn lw-btn--xs ${transcriptView === view ? "lw-btn--primary" : "lw-btn--ghost"}`}
                          onClick={() => setTranscriptView(view)}
                        >
                          {t(`studio.enhanceTranscriptView${view[0].toUpperCase()}${view.slice(1)}`)}
                        </button>
                      ))}
                    </div>

                    {enhancementStatus === "ReviewRequired" && (
                      <div style={{ background: "#F0C040", color: "#4A3A00", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: "0.8rem" }}>
                        {t("studio.enhanceTranscriptReviewRequired")}
                        <EnhancementReviewItems json={revision.enhancementReviewItemsJson} t={t} />
                      </div>
                    )}

                    <p className="muted" style={{ fontSize: "0.72rem", margin: "4px 0 8px" }}>
                      {t("studio.enhanceTranscriptMetadata", {
                        model: revision.enhancementModel ?? "?",
                        date: revision.enhancementCompletedAt ? new Date(revision.enhancementCompletedAt).toLocaleString() : "?",
                      })}
                    </p>

                    {transcriptView === "enhanced" && (
                      <div>
                        <span className="lw-tag" style={{ fontSize: "0.7rem" }}>{t("studio.enhanceTranscriptAiTag")}</span>
                        <textarea
                          readOnly rows={8} value={revision.enhancedTranscript}
                          style={{ width: "100%", marginTop: 6, fontFamily: "monospace", fontSize: "13px", background: "var(--surface-2, #f4f4f2)" }}
                        />
                      </div>
                    )}

                    {transcriptView === "compare" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <p className="muted" style={{ fontSize: "0.72rem", margin: "0 0 4px" }}>{t("studio.enhanceTranscriptViewRaw")}</p>
                          <textarea readOnly rows={10} value={transcript} style={{ width: "100%", fontFamily: "monospace", fontSize: "12px" }} />
                        </div>
                        <div>
                          <p className="muted" style={{ fontSize: "0.72rem", margin: "0 0 4px" }}>
                            {t("studio.enhanceTranscriptAiTag")}
                          </p>
                          <textarea
                            readOnly rows={10} value={revision.enhancedTranscript}
                            style={{ width: "100%", fontFamily: "monospace", fontSize: "12px", background: "var(--surface-2, #f4f4f2)" }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>
          ) : (
            <>
              {transcriptStatus === "None" && <span className="muted">{t("studio.transcriptNone")}</span>}
              {transcriptStatus === "Processing" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LoaderCircle size={13} className="lw-studio__spin" />
                  <span className="muted">{t("studio.transcriptProcessing")}</span>
                </div>
              )}
              {transcriptStatus === "Failed" && <span style={{ color: "var(--danger, #C0392B)" }}>{revision.transcriptError ?? t("studio.transcriptFailed")}</span>}
              {transcriptStatus === "Ready" && (
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                    {t("studio.transcriptReady")}
                    {transcriptSource !== "None" && (
                      <span className="muted" style={{ marginLeft: 8, fontWeight: "normal", fontSize: "0.75rem" }}>
                        ({transcriptSource})
                      </span>
                    )}
                  </summary>
                  <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{revision.transcript}</p>
                </details>
              )}
            </>
          )}
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
/** A PDF/image resource can be read by Extract; anything else (slides, worksheets, archives) can't. Same content types the backend's own pre-flight check accepts. */
const EXTRACTABLE_CONTENT_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
]);

/** Client-side hint only — the backend's own allow-list (LearningAssetService.AllowedResourceContentTypes) is what actually enforces this. No video/audio: those belong to the lesson's video upload. */
const RESOURCE_FILE_ACCEPT =
  ".pdf,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp";
function isExtractable(asset) {
  return EXTRACTABLE_CONTENT_TYPES.has((asset.contentType || "").toLowerCase());
}

function ResourcesSection({ lesson, editable, onChanged, onExtract, extractBusyId, onStructurePastedContent, structuringPastedContent }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Manual-entry fallback for Extract (e.g. the AI provider can't read
  // files directly — Ollama in this dev setup throws exactly that — or the
  // tutor just has the text already). Which resource's "paste text" box is
  // open, and the text typed into it; not resource-scoped server-side
  // (structure-pasted-content takes no resourceId), so this only tracks
  // which row's UI is expanded.
  const [pasteOpenId, setPasteOpenId] = useState(null);
  const [pasteText, setPasteText] = useState("");

  const revision = lesson.draftRevision ?? lesson.currentRevision;
  const resources = revision?.resources ?? [];

  function isExtractableFile(file) {
    const type = (file.type || "").toLowerCase();
    if (EXTRACTABLE_CONTENT_TYPES.has(type)) return true;
    return /\.(pdf|png|jpe?g|gif|webp)$/i.test(file.name || "");
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        setProgress(0);
        const asset = await api.uploadLearningAsset(session.token, slug, file, file.name, setProgress, "Resource");
        // PDF & Image Lesson Content Extraction §5 — a PDF/image attached
        // purely as AI source material (a tutor's own notes, a scan they
        // don't have redistribution rights to hand out) shouldn't
        // involuntarily become a student-facing download just because it was
        // attached. Other file types (slide decks, worksheets) default to
        // shared. Either way, the per-resource checkbox below lets the tutor
        // correct this immediately after upload.
        const visibleToLearners = !isExtractableFile(file);
        await api.addLessonResource(session.token, slug, lesson.id, asset.id, visibleToLearners);
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
    if (!window.confirm(t("studio.confirmRemoveResource"))) return;
    setError(null);
    try {
      await api.removeLessonResource(session.token, slug, lesson.id, resourceId);
      setSuccess(t("studio.toastResourceRemoved"));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleToggleVisibility(resourceId, nextVisible) {
    setError(null);
    try {
      await api.setLessonResourceVisibility(session.token, slug, lesson.id, resourceId, nextVisible);
      setSuccess(t("studio.toastResourceVisibilityUpdated"));
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleExtract(resourceId) {
    setError(null);
    setSuccess(null);
    try {
      const result = await onExtract(resourceId);
      if (result.status === "empty") setSuccess(t("studio.extractNoContent"));
      else if (result.status === "skipped") setSuccess(t("studio.extractAllFieldsFilled"));
      else setSuccess(t("studio.extractApplied"));
    } catch (e) {
      setError(e.message);
    }
  }

  function togglePasteBox(resourceId) {
    setError(null);
    setSuccess(null);
    setPasteOpenId((current) => (current === resourceId ? null : resourceId));
    setPasteText("");
  }

  async function handleUsePastedText() {
    setError(null);
    setSuccess(null);
    try {
      const result = await onStructurePastedContent(pasteText);
      if (result.status === "empty") setSuccess(t("studio.pasteNoContent"));
      else if (result.status === "skipped") setSuccess(t("studio.extractAllFieldsFilled"));
      else setSuccess(t("studio.extractApplied"));
      setPasteOpenId(null);
      setPasteText("");
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
              ref={fileInputRef} type="file" multiple accept={RESOURCE_FILE_ACCEPT} style={{ display: "none" }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        )
      )}

      {resources.length === 0 && (
        <div className="lw-studio__unitempty">{t("studio.noResources")}</div>
      )}

      {resources.length > 0 && (
        <div className="lw-studio__cardgrid">
          {resources.map((r) => (
            <div key={r.id} className={`lw-studio__resourcecard ${pasteOpenId === r.id ? "is-expanded" : ""}`}>
              <AssetLink token={session?.token} slug={slug} assetId={r.asset.id}
                 style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink)", textDecoration: "none", minWidth: 0 }}>
                <Paperclip size={14} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.asset.title}</span>
                <span className="lw-tag lw-tag--source" style={{ flexShrink: 0 }}>{Math.round(r.asset.fileSizeBytes / 1024)} KB</span>
              </AssetLink>
              {editable ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {isExtractable(r.asset) && (
                    <>
                      <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={extractBusyId === r.id}
                              onClick={() => handleExtract(r.id)} title={t("studio.extractContentHint")}>
                        {extractBusyId === r.id
                          ? <LoaderCircle size={13} className="lw-studio__spin" />
                          : <Sparkles size={13} />} {t("studio.extractContent")}
                      </button>
                      <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => togglePasteBox(r.id)}>
                        <FileText size={13} /> {t("studio.pasteContent")}
                      </button>
                    </>
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }} title={t("studio.resourceShareHint")}>
                    <input
                      type="checkbox" checked={r.visibleToLearners}
                      onChange={() => handleToggleVisibility(r.id, !r.visibleToLearners)}
                    />
                    {t("studio.resourceShare")}
                  </label>
                  <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => handleRemove(r.id)}>
                    <Trash2 size={13} /> {t("studio.remove")}
                  </button>
                </div>
              ) : (
                <Download size={14} className="muted" />
              )}
              {pasteOpenId === r.id && (
                <div>
                  <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>{t("studio.pasteContentHint")}</p>
                  <textarea
                    rows={8}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    disabled={structuringPastedContent}
                    placeholder={t("studio.pasteContentPlaceholder")}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="lw-btn lw-btn--primary lw-btn--sm" disabled={structuringPastedContent || !pasteText.trim()}
                            onClick={handleUsePastedText}>
                      {structuringPastedContent
                        ? <LoaderCircle size={13} className="lw-studio__spin" />
                        : <Sparkles size={13} />} {t("studio.useThisText")}
                    </button>
                    <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={structuringPastedContent}
                            onClick={() => togglePasteBox(r.id)}>
                      {t("studio.cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Learning Activities (the work this revision assigns to learners) ────
   Draft-only to add/edit/remove/reorder (LessonRevision.AddLearningActivity)
   — a Learning Activity is instructional design, not safe metadata like
   Resources. Each row's "Assign" button opens AssignmentModal, where a
   tutor turns it into a scheduled, policy-governed Assignment.
   ========================================================================= */

const LEARNING_ACTIVITY_TYPES = [
  "QuestionSet", "Quiz", "Homework", "Reading", "VideoActivity", "InteractiveLesson",
  "Essay", "FileUpload", "Project", "Discussion", "CodingExercise", "ReflectionJournal",
  "AiPracticeSession", "ExternalLearningTool",
];

function LearningActivitiesSection({ lesson, editable, onChanged, onRequestNewVersion }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formMode, setFormMode] = useState(null); // null | "new" | activity being edited
  const [assigningActivity, setAssigningActivity] = useState(null);
  const [viewingActivity, setViewingActivity] = useState(null);

  const hasDraft = !!lesson.draftRevision;
  const revision = lesson.draftRevision ?? lesson.currentRevision;
  const activities = [...(revision?.learningActivities ?? [])].sort((a, b) => a.position - b.position);
  // Editing Learning Activities requires an open draft, unlike Resources —
  // Learning Activity Assignment BA §8: "Editing Learning Activities after
  // publication requires creating a new Lesson Revision." Surfaced here
  // proactively (a button, not just an error after the fact) so a tutor on
  // a published lesson isn't told this only after filling out a form.
  const canEditActivities = editable && hasDraft;

  async function run(fn, successMessage) {
    setBusy(true); setError(null); setSuccess(null);
    try { const r = await fn(); if (successMessage) setSuccess(successMessage); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function saveActivity(body) {
    const result = formMode === "new"
      ? await run(() => api.addLearningActivity(session.token, slug, lesson.id, body), t("studio.toastActivityAdded"))
      : await run(() => api.updateLearningActivity(session.token, slug, lesson.id, formMode.id, body), t("studio.toastActivityUpdated"));
    if (result) { setFormMode(null); onChanged(); }
  }

  async function removeActivity(activityId) {
    if (!window.confirm(t("studio.confirmRemoveActivity"))) return;
    const result = await run(() => api.removeLearningActivity(session.token, slug, lesson.id, activityId), t("studio.toastActivityRemoved"));
    if (result) onChanged();
  }

  async function move(activityId, direction) {
    const idx = activities.findIndex((a) => a.id === activityId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= activities.length) return;
    const reordered = [...activities];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const result = await run(() => api.reorderLearningActivities(session.token, slug, lesson.id, reordered.map((a) => a.id)));
    if (result) onChanged();
  }

  return (
    <div className="lw-studio__section">
      <h2 className="lw-sectiontitle">{t("studio.activitiesTitle")}</h2>
      <p className="muted" style={{ marginTop: -8, marginBottom: 14 }}>{t("studio.activitiesHint")}</p>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {editable && (
        <div className="lw-studio__bar">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                  onClick={() => (hasDraft ? setFormMode("new") : onRequestNewVersion())}>
            <Plus size={13} /> {t("studio.addActivity")}
          </button>
        </div>
      )}

      {activities.length === 0 && (
        <div className="lw-empty">{editable ? t("studio.noActivitiesEditable") : t("studio.noActivitiesReadonly")}</div>
      )}

      {activities.length > 0 && (
        <div className="lw-studio__units" style={{ marginTop: 14 }}>
          {activities.map((activity, i) => (
            <div key={activity.id} className="lw-studio__unitrow">
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, flexWrap: "wrap" }}>
                <span className="lw-tag lw-tag--source">{t(`studio.activityType.${activity.type}`)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.title}</span>
                {activity.hasAssignment && (
                  <span className={`lw-studio__pill is-${activity.assignmentStatus.toLowerCase()}`}>{human(t, activity.assignmentStatus)}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                {canEditActivities && (
                  <>
                    <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy || i === 0} onClick={() => move(activity.id, -1)} title={t("studio.moveUp")}>
                      <ChevronUp size={13} />
                    </button>
                    <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy || i === activities.length - 1} onClick={() => move(activity.id, 1)} title={t("studio.moveDown")}>
                      <ChevronDown size={13} />
                    </button>
                  </>
                )}
                <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setAssigningActivity(activity)}>
                  <Send size={13} /> {t("studio.assign")}
                </button>
                {canEditActivities ? (
                  <>
                    <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setFormMode(activity)}>
                      <Pencil size={13} /> {t("studio.edit")}
                    </button>
                    <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => removeActivity(activity.id)}>
                      <Trash2 size={13} /> {t("studio.remove")}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Editing is blocked (no author rights, curriculum locked, or
                        this lesson has no open draft) — a tutor should still be
                        able to see what this activity contains without committing
                        to anything. */}
                    <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setViewingActivity(activity)}>
                      <Eye size={13} /> {t("studio.view")}
                    </button>
                    {/* Only when the tutor has author rights but this lesson
                        simply has no open draft yet — same "start a new version
                        first" mechanism VideoSection's Replace/Add video buttons
                        use, not a dead end. */}
                    {editable && (
                      <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onRequestNewVersion}>
                        <Pencil size={13} /> {t("studio.edit")}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formMode && (
        <Modal onClose={() => setFormMode(null)} closeLabel={t("studio.close")}>
          <h2 className="lw-modal__title">{formMode === "new" ? t("studio.addActivity") : t("studio.editActivity")}</h2>
          <LearningActivityForm initial={formMode === "new" ? null : formMode} busy={busy} onSave={saveActivity} onCancel={() => setFormMode(null)} />
        </Modal>
      )}

      {viewingActivity && (
        <Modal onClose={() => setViewingActivity(null)} closeLabel={t("studio.close")}>
          <h2 className="lw-modal__title">{t("studio.viewActivity")}</h2>
          <LearningActivityForm initial={viewingActivity} readOnly onCancel={() => setViewingActivity(null)} />
        </Modal>
      )}

      {assigningActivity && (
        <AssignmentModal
          lessonId={lesson.id} activity={assigningActivity}
          onClose={() => setAssigningActivity(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

const ACTIVITY_SUBMISSION_MODES = ["TextOrFile", "TextOnly", "FileOnly"];

function LearningActivityForm({ initial, busy = false, onSave, onCancel, readOnly = false }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;
  const disabled = busy || readOnly;
  const [type, setType] = useState(initial?.type ?? "Homework");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [externalUrl, setExternalUrl] = useState(initial?.externalUrl ?? "");
  const [submissionMode, setSubmissionMode] = useState(initial?.submissionMode ?? "TextOrFile");
  const [activityFileAssetId, setActivityFileAssetId] = useState(initial?.activityFileAssetId ?? null);
  // The file's name is only known within this session (right after an
  // upload) — an id carried over from a previous edit has no title to show,
  // same "reference by identifier only" limitation AssessmentId already has.
  const [activityFileTitle, setActivityFileTitle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const fileInputRef = useRef(null);

  // Quiz/QuestionSet never reach the free-text/file Response flow (they hand
  // off to QuizScreen entirely) — same treatment the quiz note below already
  // gives this pair of types.
  const isQuizLike = type === "Quiz" || type === "QuestionSet";

  async function handleUploadFile(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setUploading(true); setUploadError(null);
    try {
      const asset = await api.uploadLearningAsset(session.token, slug, file, file.name, undefined, "Resource");
      setActivityFileAssetId(asset.id);
      setActivityFileTitle(asset.title);
    } catch (e) { setUploadError(e.message); }
    finally { setUploading(false); }
  }

  const validationMessages = [
    !title.trim() && t("studio.enterActivityTitle"),
    type === "ExternalLearningTool" && !externalUrl.trim() && t("studio.enterActivityExternalUrl"),
  ].filter(Boolean);
  const valid = validationMessages.length === 0;

  function submit(e) {
    e.preventDefault();
    if (readOnly) return;
    if (!valid) { setAttempted(true); return; }
    onSave({
      type, title: title.trim(), instructions: instructions.trim() || null,
      assessmentId: initial?.assessmentId ?? null,
      externalUrl: type === "ExternalLearningTool" ? externalUrl.trim() : null,
      activityFileAssetId: isQuizLike ? null : activityFileAssetId,
      submissionMode: isQuizLike ? "TextOrFile" : submissionMode,
    });
  }

  return (
    <form onSubmit={submit} className="lw-studio__draftform" noValidate>
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
        <span>{t("studio.activityTypeLabel")}{!readOnly && <RequiredMark />}</span>
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={disabled}>
          {LEARNING_ACTIVITY_TYPES.map((v) => <option key={v} value={v}>{t(`studio.activityType.${v}`)}</option>)}
        </select>
      </label>
      <label>
        <span>{t("studio.activityTitleLabel")}{!readOnly && <RequiredMark />}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled}
               style={attempted && !title.trim() ? invalidFieldStyle : undefined} />
      </label>
      <label>
        <span>{t("studio.activityInstructionsLabel")}</span>
        <textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={disabled}
                  placeholder={t("studio.activityInstructionsPlaceholder")} />
      </label>
      {type === "ExternalLearningTool" && (
        <label>
          <span>{t("studio.activityExternalUrlLabel")}{!readOnly && <RequiredMark />}</span>
          <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} disabled={disabled}
                 placeholder="https://…" style={attempted && !externalUrl.trim() ? invalidFieldStyle : undefined} />
        </label>
      )}
      {isQuizLike && (
        <p className="muted" style={{ fontSize: 12 }}>{t("studio.activityQuizNote")}</p>
      )}
      {!isQuizLike && (
        <>
          <label>
            <span>{t("studio.activityFileLabel")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {activityFileAssetId ? (
                <AssetLink token={session?.token} slug={slug} assetId={activityFileAssetId}
                   style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Paperclip size={13} /> {activityFileTitle ?? t("studio.activityFileAttached")}
                </AssetLink>
              ) : readOnly && (
                <span className="muted">{t("studio.activityFileNone")}</span>
              )}
              {!readOnly && (uploading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <LoaderCircle size={14} className="lw-studio__spin" /> {t("studio.uploading")}
                </span>
              ) : (
                <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud size={13} /> {activityFileAssetId ? t("studio.activityFileReplace") : t("studio.activityFileUpload")}
                </button>
              ))}
              {!readOnly && activityFileAssetId && !uploading && (
                <button type="button" className="lw-btn lw-btn--ghost lw-btn--xs" disabled={disabled}
                        onClick={() => { setActivityFileAssetId(null); setActivityFileTitle(null); }} title={t("studio.remove")}>
                  <X size={12} />
                </button>
              )}
            </div>
            {!readOnly && (
              <input ref={fileInputRef} type="file" style={{ display: "none" }}
                     onChange={(e) => { handleUploadFile(e.target.files); e.target.value = ""; }} />
            )}
          </label>
          {uploadError && <Message type="error">{uploadError}</Message>}
          <label>
            <span>{t("studio.submissionModeLabel")}</span>
            <select value={submissionMode} onChange={(e) => setSubmissionMode(e.target.value)} disabled={disabled}>
              {ACTIVITY_SUBMISSION_MODES.map((v) => <option key={v} value={v}>{t(`studio.submissionMode.${v}`)}</option>)}
            </select>
          </label>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {!readOnly && <button type="submit" className="lw-btn lw-btn--primary lw-btn--sm" disabled={disabled}>{t("studio.save")}</button>}
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={onCancel}>{readOnly ? t("studio.close") : t("studio.cancel")}</button>
      </div>
    </form>
  );
}

/* ── Assignment (delivering one Learning Activity — scheduling, attempts,
   evaluation policy). Opened per-activity from LearningActivitiesSection.
   Recipients are never chosen here — every active Enrollment in the
   Learning Product gets it automatically (Assignment Aggregate Design
   INV-004), resolved server-side.
   ========================================================================= */

const ASSIGNMENT_AVAILABILITY_MODES = ["Immediate", "Scheduled", "Hidden"];
const ASSIGNMENT_DUE_DATE_MODES = ["None", "Fixed"];
const ASSIGNMENT_ATTEMPT_MODES = ["Single", "Multiple", "Unlimited"];
// Automatic/AiAssisted/Hybrid exist in the domain enum (Assignment Business
// Analysis §8) but no automatic-evaluation engine has been built yet — every
// submission still requires a human tutor's Pass/Fail regardless of this
// setting, and the backend now rejects configuring anything but Manual
// (Assignment.Configure). Only offering Manual here keeps this selector from
// promising something that silently did nothing.
const ASSIGNMENT_EVALUATION_METHODS = ["Manual"];

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(v) {
  return v ? new Date(v).toISOString() : null;
}

function AssignmentModal({ lessonId, activity, onClose, onChanged }) {
  const { session, workspace } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [assignment, setAssignment] = useState(undefined); // undefined = loading, null = not created yet
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);

  const [availabilityMode, setAvailabilityMode] = useState("Immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [dueDateMode, setDueDateMode] = useState("None");
  const [dueAt, setDueAt] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [attemptMode, setAttemptMode] = useState("Single");
  const [maxAttempts, setMaxAttempts] = useState("2");
  const [evaluationMethod, setEvaluationMethod] = useState("Manual");
  const [notifyOnPublish, setNotifyOnPublish] = useState(true);
  const [notifyOnFeedbackPublished, setNotifyOnFeedbackPublished] = useState(true);

  function applyToForm(a) {
    setAvailabilityMode(a.availabilityMode);
    setScheduledAt(toLocalInputValue(a.scheduledAvailabilityAt));
    setDueDateMode(a.dueDateMode);
    setDueAt(toLocalInputValue(a.dueAt));
    setWindowStart(toLocalInputValue(a.submissionWindowStartAt));
    setWindowEnd(toLocalInputValue(a.submissionWindowEndAt));
    setAttemptMode(a.attemptMode);
    setMaxAttempts(a.maxAttempts != null ? String(a.maxAttempts) : "2");
    setEvaluationMethod(a.evaluationMethod);
    setNotifyOnPublish(a.notifyOnPublish);
    setNotifyOnFeedbackPublished(a.notifyOnFeedbackPublished);
  }

  const load = useCallback(() => (
    api.getAssignment(session.token, slug, lessonId, activity.id)
      .then((a) => { applyToForm(a); setAssignment(a); setError(null); return a; })
      .catch((e) => {
        if (e.status === 404) { setAssignment(null); setError(null); return null; }
        setError(e.message); return null;
      })
  ), [session.token, slug, lessonId, activity.id]);

  useEffect(() => { load(); }, [load]);

  async function run(fn, successMessage) {
    setBusy(true); setError(null); setSuccess(null);
    try { const r = await fn(); if (successMessage) setSuccess(successMessage); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  async function handleCreate() {
    const result = await run(() => api.createAssignment(session.token, slug, lessonId, activity.id), t("studio.toastAssignmentCreated"));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  async function handleConfigure() {
    const body = {
      availabilityMode, scheduledAvailabilityAt: availabilityMode === "Scheduled" ? fromLocalInputValue(scheduledAt) : null,
      dueDateMode, dueAt: dueDateMode === "Fixed" ? fromLocalInputValue(dueAt) : null,
      submissionWindowStartAt: fromLocalInputValue(windowStart), submissionWindowEndAt: fromLocalInputValue(windowEnd),
      attemptMode, maxAttempts: attemptMode === "Multiple" ? (Number(maxAttempts) || 1) : null,
      evaluationMethod, notifyOnPublish, notifyOnFeedbackPublished,
    };
    const result = await run(() => api.configureAssignment(session.token, slug, lessonId, activity.id, body), t("studio.toastAssignmentConfigured"));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  async function handleTransition(transition, successKey) {
    const result = await run(() => api.assignmentTransition(session.token, slug, lessonId, activity.id, transition), t(successKey));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  async function handleExtendDueDate() {
    const iso = fromLocalInputValue(dueAt);
    if (!iso) return;
    const result = await run(() => api.extendAssignmentDueDate(session.token, slug, lessonId, activity.id, iso), t("studio.toastDueDateExtended"));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  async function handleChangeAttemptLimit() {
    const n = Number(maxAttempts);
    if (!n || n <= 0) return;
    const result = await run(() => api.changeAssignmentAttemptLimit(session.token, slug, lessonId, activity.id, n), t("studio.toastAttemptLimitChanged"));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  async function handleToggleVisibility() {
    const result = await run(() => api.changeAssignmentVisibility(session.token, slug, lessonId, activity.id, !assignment.visible), t("studio.toastVisibilityChanged"));
    if (result) { applyToForm(result); setAssignment(result); onChanged(); }
  }

  return (
    <Modal onClose={onClose} closeLabel={t("studio.close")}>
      <h2 className="lw-modal__title">{t("studio.assignActivity", { title: activity.title })}</h2>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {assignment === undefined && (
        <div className="lw-studio__loading"><LoaderCircle size={16} className="lw-studio__spin" /> {t("studio.loading")}</div>
      )}

      {assignment === null && (
        <div>
          <p className="muted">{t("studio.noAssignmentYet")}</p>
          <button className="lw-btn lw-btn--primary lw-btn--sm" disabled={busy} onClick={handleCreate}>
            <Plus size={13} /> {t("studio.createAssignment")}
          </button>
        </div>
      )}

      {assignment && (
        <>
          <div className="lw-studio__heading" style={{ marginBottom: 8 }}>
            <span className={`lw-studio__pill is-${assignment.status.toLowerCase()}`}>{human(t, assignment.status)}</span>
          </div>

          {assignment.publicationBlocker && (
            <div className="lw-studio__blocker"><AlertCircle size={14} /> {assignment.publicationBlocker}</div>
          )}

          <div className="lw-studio__draftform">
            <label>
              <span>{t("studio.availabilityLabel")}</span>
              <select value={availabilityMode} onChange={(e) => setAvailabilityMode(e.target.value)} disabled={busy}>
                {ASSIGNMENT_AVAILABILITY_MODES.map((v) => <option key={v} value={v}>{t(`studio.availabilityMode.${v}`)}</option>)}
              </select>
            </label>
            {availabilityMode === "Scheduled" && (
              <label>
                <span>{t("studio.scheduledAtLabel")}</span>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={busy} />
              </label>
            )}

            <label>
              <span>{t("studio.dueDateModeLabel")}</span>
              <select value={dueDateMode} onChange={(e) => setDueDateMode(e.target.value)} disabled={busy}>
                {ASSIGNMENT_DUE_DATE_MODES.map((v) => <option key={v} value={v}>{t(`studio.dueDateMode.${v}`)}</option>)}
              </select>
            </label>
            {dueDateMode === "Fixed" && (
              <label>
                <span>{t("studio.dueAtLabel")}</span>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={busy} />
              </label>
            )}

            <label>
              <span>{t("studio.submissionWindowLabel")}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} disabled={busy} />
                <input type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} disabled={busy} />
              </div>
            </label>

            <label>
              <span>{t("studio.attemptModeLabel")}</span>
              <select value={attemptMode} onChange={(e) => setAttemptMode(e.target.value)} disabled={busy}>
                {ASSIGNMENT_ATTEMPT_MODES.map((v) => <option key={v} value={v}>{t(`studio.attemptMode.${v}`)}</option>)}
              </select>
            </label>
            {attemptMode === "Multiple" && (
              <label>
                <span>{t("studio.maxAttemptsLabel")}</span>
                <input type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} disabled={busy} />
              </label>
            )}

            <label>
              <span>{t("studio.evaluationMethodLabel")}</span>
              <select value={evaluationMethod} onChange={(e) => setEvaluationMethod(e.target.value)} disabled={busy}>
                {ASSIGNMENT_EVALUATION_METHODS.map((v) => <option key={v} value={v}>{t(`studio.evaluationMethod.${v}`)}</option>)}
              </select>
            </label>

            <div className="lw-studio__checkboxrow">
              <label>
                <input type="checkbox" checked={notifyOnPublish} onChange={(e) => setNotifyOnPublish(e.target.checked)} disabled={busy} />
                <span>{t("studio.notifyOnPublishLabel")}</span>
              </label>
            </div>
            <div className="lw-studio__checkboxrow">
              <label>
                <input type="checkbox" checked={notifyOnFeedbackPublished} onChange={(e) => setNotifyOnFeedbackPublished(e.target.checked)} disabled={busy} />
                <span>{t("studio.notifyOnFeedbackLabel")}</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="lw-btn lw-btn--primary lw-btn--sm" disabled={busy} onClick={handleConfigure}>
                <Check size={13} /> {t("studio.saveConfiguration")}
              </button>

              {assignment.status === "Draft" && (
                <button className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !!assignment.publicationBlocker}
                        onClick={() => handleTransition("publish", "studio.toastAssignmentPublished")}>
                  <Send size={13} /> {t("studio.publishAssignment")}
                </button>
              )}
              {["Scheduled", "Published", "Active"].includes(assignment.status) && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                        onClick={() => handleTransition("close", "studio.toastAssignmentClosed")}>
                  <Archive size={13} /> {t("studio.closeAssignment")}
                </button>
              )}
              {assignment.status === "Closed" && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy}
                        onClick={() => handleTransition("archive", "studio.toastAssignmentArchived")}>
                  <Archive size={13} /> {t("studio.archiveAssignment")}
                </button>
              )}
              {assignment.status !== "Archived" && (
                <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={handleToggleVisibility}>
                  <Eye size={13} /> {assignment.visible ? t("studio.hideAssignment") : t("studio.showAssignment")}
                </button>
              )}
            </div>

            {assignment.dueDateMode === "Fixed" && !["Draft", "Archived"].includes(assignment.status) && (
              <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={handleExtendDueDate} style={{ alignSelf: "flex-start" }}>
                <CalendarClock size={13} /> {t("studio.extendDueDate")}
              </button>
            )}
            {assignment.attemptMode !== "Unlimited" && !["Draft", "Archived"].includes(assignment.status) && (
              <button className="lw-btn lw-btn--ghost lw-btn--xs" disabled={busy} onClick={handleChangeAttemptLimit} style={{ alignSelf: "flex-start" }}>
                <RotateCcw size={13} /> {t("studio.applyAttemptLimit")}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
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
  const [viewingQuestion, setViewingQuestion] = useState(null);
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
      assessedObjective: s.assessedObjective ?? null,
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
          {data.questions.length > 0 && (
            <AttemptLimitControl
              value={data.attemptLimit} busy={busy}
              onSave={(next) => run(
                () => api.saveAssessment(session.token, slug, lessonId, { title: data.title, passingThresholdPercent: data.passingThresholdPercent, attemptLimit: next }),
                t("studio.toastAttemptLimitSaved")).then((r) => r && setData(r))}
            />
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
        <Modal onClose={() => setFormMode(null)} closeLabel={t("studio.close")}>
          <h2 className="lw-modal__title">{formMode === "new" ? t("studio.addQuestion") : t("studio.editQuestion")}</h2>
          <QuestionForm
            initial={formMode === "new" ? null : formMode}
            busy={busy}
            onSave={saveQuestion}
            onCancel={() => setFormMode(null)}
            existingQuestions={data.questions}
            videoDurationSeconds={videoDurationSeconds}
          />
        </Modal>
      )}

      {data.questions.length === 0 && suggestions.length === 0 && (
        <div className="lw-empty">
          {editable ? t("studio.noQuestionsEditable") : t("studio.noQuestionsReadonly")}
        </div>
      )}

      {data.questions.length > 0 && (
        <QuestionsTable
          questions={data.questions} editable={editable} showTimestamp
          onEdit={setFormMode} onView={setViewingQuestion}
        />
      )}

      {viewingQuestion && (
        <QuestionInfoModal
          question={viewingQuestion} editable={editable}
          onEdit={(q) => { setViewingQuestion(null); setFormMode(q); }}
          onRemove={(id) => { setViewingQuestion(null); removeQuestion(id); }}
          onClose={() => setViewingQuestion(null)}
        />
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
  const [viewingQuestion, setViewingQuestion] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);

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
      assessedObjective: s.assessedObjective ?? null,
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

  async function saveAdaptive(body) {
    const result = await run(() => api.configureAdaptiveAssessment(session.token, slug, lessonId, body), t("studio.toastAdaptiveSaved"));
    if (result) { setData(result); setAdaptiveOpen(false); }
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
        {data.adaptiveConfiguration?.enabled && (
          <span className="lw-tag" title={t("studio.adaptiveEnabledHint", { count: data.adaptiveConfiguration.questionsPerAttempt })}>
            <SlidersHorizontal size={11} /> {t("studio.adaptiveEnabledBadge")}
          </span>
        )}
      </div>
      <p className="muted" style={{ margin: "-6px 0 10px" }}>{t("studio.standaloneQuizHint")}</p>
      <Notice tone="warning" style={{ marginBottom: 14 }}>{t("studio.standaloneQuizSaveWarning")}</Notice>

      {error && <Message type="error">{error}</Message>}
      {success && <Message type="success">{success}</Message>}

      {editable && <TutorTip id="studio.quizGenTip">{t("studio.quizGenTip")}</TutorTip>}

      {editable && (
        <div className="lw-studio__bar">
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy || suggesting} onClick={handleAiSuggest}>
            <Sparkles size={13} /> {t("studio.askAiSuggestQuestions")}
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setFormMode("new")}>
            <Plus size={13} /> {t("studio.addQuestion")}
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setAdaptiveOpen(true)}>
            <SlidersHorizontal size={13} /> {t("studio.adaptiveSettings")}
          </button>
          {data.questions.length > 0 && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" disabled={busy} onClick={() => setPreviewOpen(true)}>
              <Bot size={13} /> {t("studio.previewAiGrading")}
            </button>
          )}
          {data.questions.length > 0 && (
            <AttemptLimitControl
              value={data.attemptLimit} busy={busy}
              onSave={(next) => run(
                () => api.saveStandaloneAssessment(session.token, slug, lessonId, { title: data.title, passingThresholdPercent: data.passingThresholdPercent, attemptLimit: next }),
                t("studio.toastAttemptLimitSaved")).then((r) => r && setData(r))}
            />
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
        <Modal onClose={() => setFormMode(null)} closeLabel={t("studio.close")}>
          <h2 className="lw-modal__title">{formMode === "new" ? t("studio.addQuestion") : t("studio.editQuestion")}</h2>
          <QuestionForm
            initial={formMode === "new" ? null : formMode}
            busy={busy}
            onSave={saveQuestion}
            onCancel={() => setFormMode(null)}
            existingQuestions={data.questions}
            requireTimestamp={false}
          />
        </Modal>
      )}

      {data.questions.length === 0 && suggestions.length === 0 && (
        <div className="lw-empty">
          {editable ? t("studio.noQuestionsEditable") : t("studio.noQuestionsReadonly")}
        </div>
      )}

      {data.questions.length > 0 && (
        <QuestionsTable
          questions={data.questions} editable={editable} showTimestamp={false}
          onEdit={setFormMode} onView={setViewingQuestion}
        />
      )}

      {viewingQuestion && (
        <QuestionInfoModal
          question={viewingQuestion} editable={editable}
          onEdit={(q) => { setViewingQuestion(null); setFormMode(q); }}
          onRemove={(id) => { setViewingQuestion(null); removeQuestion(id); }}
          onClose={() => setViewingQuestion(null)}
        />
      )}

      {previewOpen && (
        <PreviewPanel
          questions={data.questions}
          onClose={() => setPreviewOpen(false)}
          onSubmit={(answers) => api.previewStandaloneAssessment(session.token, slug, lessonId, answers)}
        />
      )}

      {adaptiveOpen && (
        <AdaptiveConfigModal
          config={data.adaptiveConfiguration} busy={busy}
          onSave={saveAdaptive} onClose={() => setAdaptiveOpen(false)}
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

/** "Easy" | "Medium" | "Hard" (backend/src/Platform.Domain/AssessmentEnums.cs's DifficultyTier) — a fixed three-value enum, so unlike QuestionType there's no reference endpoint to fetch labels from. */
const difficultyLabel = (t, tier) => t(`studio.difficulty${tier}`);

/** Renders a question's answer key the way its type calls for — options, accepted phrasings, or nothing at all. */
function AnswerKeyDisplay({ type, options, correctOptionIndex, acceptedAnswers }) {
  const { t } = useLanguage();
  if (type === "CompleteTheSentence") {
    return (
      <div className="discover-tag-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(acceptedAnswers ?? []).map((a, i) => (
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
      {(options ?? []).map((opt, i) => (
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
      {s.assessedObjective && (
        <p className="muted" style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          <Target size={12} /> {t("studio.learningObjective")}: {s.assessedObjective}
        </p>
      )}
      <div className="lw-rowactions" style={{ marginTop: 12 }}>
        <button className="active" disabled={busy} aria-label={t("studio.accept")} onClick={() => onAccept(s)}><Check size={13} /></button>
        <button className="active danger" disabled={busy} aria-label={t("studio.removeSuggestion")} onClick={() => onReject(s.key)}><X size={13} /></button>
      </div>
    </div>
  );
}

/** A learner's correct answer is always disclosed after grading (Assessment.
    Grade), so without a cap they could pass any quiz after one deliberately-
    wrong "scouting" attempt. Null/empty means unlimited (the historical
    default) — commits on blur, only calling onSave when the value actually
    changed, and shows nothing until at least one question exists. */
function AttemptLimitControl({ value, busy, onSave }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Math.max(1, parseInt(trimmed, 10) || 1);
    if (next === value) { setDraft(next == null ? "" : String(next)); return; }
    onSave(next);
  }

  return (
    <label className="lw-studio__attemptlimit" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
      {t("studio.attemptLimit")}
      <input
        type="number" min="1" placeholder={t("studio.attemptLimitUnlimited")}
        value={draft} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        style={{ width: 64 }}
      />
    </label>
  );
}

/** One row per question: timestamp (when this list is video-timed), type,
    a truncated prompt, points, and exactly two actions — view full detail,
    or edit. Removing a question lives inside the view-detail modal instead
    of a third icon here, so this row stays scannable at a glance. */
function QuestionsTable({ questions, editable, showTimestamp, onEdit, onView }) {
  const types = useQuestionTypes();
  const { t } = useLanguage();
  const rowClass = `lw-qtable__row${showTimestamp ? "" : " lw-qtable__row--notime"}`;
  return (
    <div className="lw-qtable">
      <div className={`${rowClass} lw-qtable__row--head`}>
        {showTimestamp && <span>{t("studio.questionTime")}</span>}
        <span>{t("studio.type")}</span>
        <span>{t("studio.questionLabel")}</span>
        <span>{t("studio.points")}</span>
        <span />
      </div>
      {questions.map((q) => (
        <div className={rowClass} key={q.id}>
          {showTimestamp && (
            <span className="lw-qtable__time">{q.videoTimestampSeconds != null ? formatTime(q.videoTimestampSeconds) : "—"}</span>
          )}
          <span>
            <span className="lw-tag">{typeLabel(types, q.type)}</span>
            {q.difficultyTier && <span className="lw-tag" style={{ marginLeft: 4 }}>{difficultyLabel(t, q.difficultyTier)}</span>}
          </span>
          <span className="lw-qtable__prompt">{q.prompt}</span>
          <span className="lw-qtable__points">{q.points}</span>
          <span className="lw-qtable__actions">
            <button aria-label={t("studio.viewQuestion")} onClick={() => onView(q)}><Eye size={13} /></button>
            {editable && <button aria-label={t("studio.editQuestion")} onClick={() => onEdit(q)}><Pencil size={13} /></button>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The full-detail view a compact table row can't show — type, timestamp,
    complete prompt, answer key and explanation — plus, for an editable
    list, the Edit and Remove actions that used to live directly on the
    (now removed) full-size question card. */
function QuestionInfoModal({ question, editable, onEdit, onRemove, onClose }) {
  const types = useQuestionTypes();
  const { t } = useLanguage();
  return (
    <Modal onClose={onClose} closeLabel={t("studio.close")}>
      <h2 className="lw-modal__title">{t("studio.questionDetails")}</h2>
      <div style={{ marginBottom: 8 }}>
        <span className="lw-tag" style={{ marginRight: 8 }}>{typeLabel(types, question.type)}</span>
        {question.difficultyTier && <span className="lw-tag" style={{ marginRight: 8 }}>{difficultyLabel(t, question.difficultyTier)}</span>}
        {question.videoTimestampSeconds != null && <span className="lw-timestamp lw-tag">{formatTime(question.videoTimestampSeconds)}</span>}
      </div>
      <p className="lw-questioncard__prompt" style={{ fontSize: "0.95rem", margin: "0 0 10px" }}>{question.prompt}</p>
      <AnswerKeyDisplay type={question.type} options={question.options} correctOptionIndex={question.correctOptionIndex} acceptedAnswers={question.acceptedAnswers} />
      {question.explanation && <p className="lw-rationale"><Sparkles size={12} /> {question.explanation}</p>}
      {question.assessedObjective && (
        <p className="muted" style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          <Target size={12} /> {t("studio.learningObjective")}: {question.assessedObjective}
        </p>
      )}
      <p className="muted" style={{ margin: "12px 0 0" }}>{t("studio.points")}: {question.points}</p>
      {editable && (
        <div className="lw-modal__actions" style={{ marginTop: 22 }}>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => {
            if (!window.confirm(t("studio.confirmRemoveQuestion"))) return;
            onRemove(question.id);
          }}>
            <Trash2 size={13} /> {t("studio.removeQuestion")}
          </button>
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => onEdit(question)}>
            <Pencil size={13} /> {t("studio.editQuestion")}
          </button>
        </div>
      )}
    </Modal>
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
  const [assessedObjective, setAssessedObjective] = useState(initial?.assessedObjective ?? "");
  const [difficultyTier, setDifficultyTier] = useState(initial?.difficultyTier ?? "");
  const [attempted, setAttempted] = useState(false);

  // Difficulty tier only makes sense for a Standalone question (adaptive
  // pools are Standalone-only, Adaptive Assessment — Design Proposal §3) and
  // only for an auto-gradable type — OpenAnswer has no synchronous
  // correctness signal for the staircase rule (§6), and the backend rejects
  // the combination outright.
  const allowDifficultyTier = !requireTimestamp && type !== "OpenAnswer";

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
    } else if (next === "OpenAnswer") {
      setDifficultyTier("");
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
      className="lw-studio__draftform" noValidate
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
          assessedObjective: assessedObjective.trim() || null,
          difficultyTier: allowDifficultyTier && difficultyTier ? difficultyTier : null,
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

      <label>
        <span>{t("studio.learningObjective")} <em>{t("studio.optional")}</em></span>
        <input type="text" value={assessedObjective} onChange={(e) => setAssessedObjective(e.target.value)} disabled={busy}
               placeholder={t("studio.learningObjectivePlaceholder")} />
      </label>

      {allowDifficultyTier && (
        <label>
          <span>{t("studio.difficultyTier")} <em>{t("studio.optional")}</em></span>
          <select value={difficultyTier} onChange={(e) => setDifficultyTier(e.target.value)} disabled={busy}>
            <option value="">{t("studio.difficultyTierNone")}</option>
            <option value="Easy">{t("studio.difficultyEasy")}</option>
            <option value="Medium">{t("studio.difficultyMedium")}</option>
            <option value="Hard">{t("studio.difficultyHard")}</option>
          </select>
        </label>
      )}

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
      {allowDifficultyTier && difficultyTier && (
        <p className="muted" style={{ gridColumn: "2", margin: "-8px 0 0", fontSize: "0.82rem" }}>{t("studio.pointsOverriddenByDifficultyNote")}</p>
      )}

      <div className="lw-studio__panelactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>{t("studio.cancel")}</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
          <Check size={13} /> {t("studio.saveQuestion")}
        </button>
      </div>
    </form>
  );
}

const DIFFICULTY_TIERS = ["Easy", "Medium", "Hard"];

/**
 * Adaptive delivery settings for the Standalone quiz (Adaptive Assessment —
 * Design Proposal §3, §4a.3) — off by default, opted into per Assessment via
 * PUT .../standalone-assessment/adaptive. Once enabled, publishing is
 * blocked (data.publicationBlocker, same mechanism as "needs a question")
 * until the pool has enough tier-tagged Questions for the worst realistic
 * path — this form doesn't duplicate that check, the backend already
 * computes and surfaces it after Save.
 */
function AdaptiveConfigModal({ config, busy, onSave, onClose }) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(config?.enabled ?? false);
  const [questionsPerAttempt, setQuestionsPerAttempt] = useState(config?.questionsPerAttempt ?? 10);
  const [startingDifficulty, setStartingDifficulty] = useState(config?.startingDifficulty ?? "Medium");
  const [minDifficulty, setMinDifficulty] = useState(config?.minDifficulty ?? "Easy");
  const [maxDifficulty, setMaxDifficulty] = useState(config?.maxDifficulty ?? "Hard");
  const [difficultyPoints, setDifficultyPoints] = useState({
    Easy: config?.difficultyPoints?.Easy ?? 1,
    Medium: config?.difficultyPoints?.Medium ?? 2,
    Hard: config?.difficultyPoints?.Hard ?? 3,
  });
  const [attempted, setAttempted] = useState(false);

  const tierIndex = (tier) => DIFFICULTY_TIERS.indexOf(tier);
  const validationMessages = [
    enabled && (Number(questionsPerAttempt) || 0) <= 0 && t("studio.adaptiveEnterQuestionsPerAttempt"),
    enabled && tierIndex(minDifficulty) > tierIndex(maxDifficulty) && t("studio.adaptiveMinAboveMax"),
    enabled && (tierIndex(startingDifficulty) < tierIndex(minDifficulty) || tierIndex(startingDifficulty) > tierIndex(maxDifficulty))
      && t("studio.adaptiveStartOutOfRange"),
  ].filter(Boolean);
  const valid = validationMessages.length === 0;

  return (
    <Modal onClose={onClose} closeLabel={t("studio.close")}>
      <h2 className="lw-modal__title">{t("studio.adaptiveSettings")}</h2>
      <p className="muted" style={{ margin: "0 0 14px" }}>{t("studio.adaptiveSettingsHint")}</p>

      <form
        className="lw-studio__draftform" noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) { setAttempted(true); return; }
          onSave({
            enabled,
            questionsPerAttempt: Number(questionsPerAttempt) || 1,
            startingDifficulty, minDifficulty, maxDifficulty,
            difficultyPoints: {
              Easy: Number(difficultyPoints.Easy) || 1,
              Medium: Number(difficultyPoints.Medium) || 1,
              Hard: Number(difficultyPoints.Hard) || 1,
            },
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
          <span>{t("studio.adaptiveEnabled")}</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={busy}
                 style={{ width: "auto", justifySelf: "start" }} />
        </label>

        {enabled && (
          <>
            <label>
              <span>{t("studio.adaptiveQuestionsPerAttempt")}<RequiredMark /></span>
              <input type="number" min="1" value={questionsPerAttempt} onChange={(e) => setQuestionsPerAttempt(e.target.value)} disabled={busy}
                     style={attempted && (Number(questionsPerAttempt) || 0) <= 0 ? invalidFieldStyle : undefined} />
            </label>

            <label>
              <span>{t("studio.adaptiveStartingDifficulty")}</span>
              <select value={startingDifficulty} onChange={(e) => setStartingDifficulty(e.target.value)} disabled={busy}>
                {DIFFICULTY_TIERS.map((tier) => <option key={tier} value={tier}>{difficultyLabel(t, tier)}</option>)}
              </select>
            </label>

            <label>
              <span>{t("studio.adaptiveMinDifficulty")}</span>
              <select value={minDifficulty} onChange={(e) => setMinDifficulty(e.target.value)} disabled={busy}>
                {DIFFICULTY_TIERS.map((tier) => <option key={tier} value={tier}>{difficultyLabel(t, tier)}</option>)}
              </select>
            </label>

            <label>
              <span>{t("studio.adaptiveMaxDifficulty")}</span>
              <select value={maxDifficulty} onChange={(e) => setMaxDifficulty(e.target.value)} disabled={busy}>
                {DIFFICULTY_TIERS.map((tier) => <option key={tier} value={tier}>{difficultyLabel(t, tier)}</option>)}
              </select>
            </label>

            <label>
              <span>{t("studio.adaptiveDifficultyPoints")}</span>
              <div style={{ display: "flex", gap: 10 }}>
                {DIFFICULTY_TIERS.map((tier) => (
                  <div key={tier} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <em style={{ fontSize: "0.75rem" }}>{difficultyLabel(t, tier)}</em>
                    <input type="number" min="1" value={difficultyPoints[tier]}
                           onChange={(e) => setDifficultyPoints((prev) => ({ ...prev, [tier]: e.target.value }))}
                           disabled={busy} style={{ width: 64 }} />
                  </div>
                ))}
              </div>
            </label>
          </>
        )}

        <div className="lw-studio__panelactions">
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onClose} disabled={busy}>{t("studio.cancel")}</button>
          <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy}>
            <Check size={13} /> {t("studio.save")}
          </button>
        </div>
      </form>
    </Modal>
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
    background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 0; margin-bottom: 14px;
  }
  .lw-studio__back:hover { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }

  /* Product / Unit / Lesson cascading pickers on the full-page lesson
     editor — three columns side by side where there's room, with the
     lesson content (or an empty-state message) spanning the full row
     beneath via grid-column: 1 / -1 (set inline per-element, same
     convention as .lw-studio__draftform's full-span children). */
  .lw-studio__picker {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px; align-items: end;
    margin: 18px 0 22px; padding-bottom: 18px; border-bottom: 1px solid var(--line);
  }
  .lw-studio__picker label { display: flex; flex-direction: column; gap: 5px; }
  .lw-studio__picker label > span { font-size: 0.78rem; font-weight: 600; color: var(--ink-soft); }
  .lw-studio__picker select {
    font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 9px 11px;
  }
  .lw-studio__picker select:disabled { opacity: 0.55; cursor: not-allowed; }
  .lw-studio__pickeredit { margin-bottom: 4px; }
  .lw-studio__pickeredit .muted { margin: -4px 0 0; }

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

  /* Resources / Interactive Questions / Lesson Quiz — each item is a card in
     a grid rather than a stacked list. A card being edited in place (a
     <form>, or a resource card with its paste-box open) spans every column
     so the tutor gets room to work instead of a cramped single cell. */
  .lw-studio__cardgrid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px; align-items: start;
  }
  .lw-studio__cardgrid > form,
  .lw-studio__cardgrid > .lw-studio__resourcecard.is-expanded {
    grid-column: 1 / -1;
  }
  .lw-studio__resourcecard {
    display: flex; flex-direction: column; gap: 10px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 12px 14px;
  }
  .lw-studio__unitrow {
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 10px 14px;
  }
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
  /* Kept off the notebook script font deliberately (2026-08-15) — this is an
     active text-edit field, not a display label, and a cursive font makes it
     harder to read what you're actually typing while renaming a unit. */
  .lw-studio__renameform input {
    flex: 1; font-family: var(--font-body); font-weight: 600; font-size: 0.95rem;
    border: 1px solid var(--accent); border-radius: 6px; padding: 5px 9px; background: var(--bg); color: var(--ink);
  }
  .lw-studio__renameform button { background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--accent); cursor: pointer; display: flex; }
  .lw-studio__renameform button:hover, .lw-studio__renameform button:focus-visible { background: var(--surface-2, rgba(0,0,0,0.05)); }

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

  .lw-studio__productgrid {
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
  .lw-studio__cardcoverimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
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
  /* A checkbox + its own label read as one unit, not a label/value pair.
     Deliberately a <div>, not a <label>, as the grid's direct child — the
     grid's own "> label { display: contents }" rule (targeting the *tag*,
     for the ordinary span/input field pairs) would otherwise catch this too
     and split the checkbox from its text across the two grid columns. Using
     a div sidesteps that rule instead of trying to out-rank it with a more
     specific override, which proved inconsistent across browser engines. */
  .lw-studio__draftform > .lw-studio__checkboxrow { grid-column: 1 / -1; }
  .lw-studio__checkboxrow label { display: flex; flex-direction: row; justify-content: flex-start; align-items: center; gap: 8px; cursor: pointer; }
  .lw-studio__checkboxrow input[type="checkbox"] { flex-shrink: 0; }
  .lw-studio__checkboxrow span { font-size: 0.85rem; font-weight: 400; padding-top: 0; white-space: normal; }
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

  .lw-studio__requirequiz {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px; cursor: pointer;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 18px;
  }
  .lw-studio__requirequiz input { flex-shrink: 0; }
  .lw-studio__requirequiz span { font-size: 0.85rem; }
  .lw-option.is-selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--bg)); }

  /* Same underline-tab convention as .lw-members__tabs (MembersScreen) — a
     bottom border line the tabs sit on, each tab its own bordered box, the
     active one picking up an accent-colored underline. Kept identical on
     purpose so tab bars read the same wherever they appear in the app. */
  .lw-studio__tabs {
    display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; overflow-x: auto;
    border-bottom: 1px solid var(--line); width: fit-content; max-width: 100%; margin: 14px 0 20px;
  }
  .lw-studio__tabs button {
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; white-space: nowrap;
    font-family: var(--font-body); font-size: 0.85rem; font-weight: 600; color: var(--ink-soft);
    background: transparent; border: 1px solid var(--line); border-radius: 6px; border-bottom: 2px solid transparent;
    padding: 9px 14px; cursor: pointer; margin-bottom: -1px; transition: background .12s, color .12s;
  }
  .lw-studio__tabs button:hover:not(.active) { color: var(--ink); background: var(--surface-2, rgba(0,0,0,0.05)); }
  .lw-studio__tabs button.active { color: var(--ink); border-bottom-color: var(--accent); }

  /* Questions table (see QuestionsTable) — timestamp/type/question/points
     columns plus a compact pair of icon actions, replacing what used to be
     a full-detail card per question. Full detail now lives one click away
     in QuestionInfoModal instead of always being on screen. */
  .lw-qtable { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; margin-top: 14px; }
  .lw-qtable__row {
    display: grid; grid-template-columns: 70px 150px 1fr 60px 68px; gap: 10px; align-items: center;
    padding: 10px 14px; font-size: 0.85rem; background: var(--surface); border-bottom: 1px solid var(--line);
  }
  .lw-qtable__row--notime { grid-template-columns: 150px 1fr 60px 68px; }
  .lw-qtable__row:last-child { border-bottom: none; }
  .lw-qtable__row--head {
    background: var(--surface-2); font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); padding: 9px 14px;
  }
  .lw-qtable__time { font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink-soft); }
  .lw-qtable__prompt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lw-qtable__points { font-family: var(--font-mono); color: var(--ink-soft); }
  .lw-qtable__actions { display: flex; gap: 4px; justify-self: end; }
  .lw-qtable__actions button {
    width: 26px; height: 26px; border-radius: var(--radius-sm); border: 1px solid var(--line);
    background: var(--surface); color: var(--ink-soft); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all .12s;
  }
  .lw-qtable__actions button:hover { color: var(--ink); border-color: var(--accent); }
  /* Below this width a grid row can't fit five columns legibly — each
     question becomes a small stacked card instead, same info, no table. */
  @media (max-width: 700px) {
    .lw-qtable__row, .lw-qtable__row--notime {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
    }
    .lw-qtable__row--head { display: none; }
    .lw-qtable__prompt { flex: 1 1 100%; white-space: normal; order: -1; font-size: 0.88rem; }
    .lw-qtable__actions { margin-inline-start: auto; }
  }

  ${MODAL_CSS}
`;
