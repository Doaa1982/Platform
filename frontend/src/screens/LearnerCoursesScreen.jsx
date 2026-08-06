import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, ArrowLeft, BookOpen, CheckCircle2, PlayCircle,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

/* =========================================================================
   COURSES — a Learner's Published products and their Published curriculum.

   Mirrors ContentStudioScreen's own picker/detail split (productId prop +
   onSelectProduct callback owned by App.jsx), but read-only: no editing, no
   drafts, no unpublished units or lessons — only what a Learner may actually
   see (Learning Delivery Context's ownership boundary).
   ========================================================================= */

const human = (s) => (s ?? "").replace(/([a-z])([A-Z])/g, "$1 $2");

/** A small, fixed palette so each product gets a stable "cover" color from its id — matches ProductsScreen/ContentStudioScreen. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

export default function LearnerCoursesScreen({ productId, onSelectProduct, onOpenLesson }) {
  return productId
    ? <CurriculumView key={productId} productId={productId} onBack={() => onSelectProduct(null)} onOpenLesson={onOpenLesson} />
    : <ProductPicker onSelect={onSelectProduct} />;
}

function ProductPicker({ onSelect }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getLearnerProducts(session.token, slug)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  if (error) {
    return <div className="lw-page"><style>{CSS}</style><div className="lw-learn__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <div className="lw-eyebrow">Courses</div>
      <h1>What do you want to learn?</h1>
      <p className="lw-sub">Everything published here that you can open.</p>

      {data.products.length === 0 && (
        <div className="lw-learn__empty">
          <BookOpen size={26} />
          <h2>Nothing published yet</h2>
          <p>When your tutor publishes a course, it will appear here.</p>
        </div>
      )}

      <div className="lw-learn__grid">
        {data.products.map((p) => (
          <button
            className="lw-learn__card" key={p.id}
            onClick={() => p.hasContent && onSelect(p.id)}
            disabled={!p.hasContent}
          >
            <div className={`lw-learn__cover lw-cover--${coverVariant(p.id)}`}>
              <span className="lw-learn__monogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
            </div>
            <div className="lw-learn__cardbody">
              <div className="lw-learn__cardtitle">{p.title}</div>
              {p.description && <p className="lw-learn__carddesc">{p.description}</p>}
              {!p.hasContent && <span className="lw-learn__cardnote">Nothing published inside yet</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CurriculumView({ productId, onBack, onOpenLesson }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    () => api.getLearnerCurriculum(session.token, slug, productId)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug, productId]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-learn__alert"><AlertCircle size={16} /> {error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="lw-page">
        <style>{CSS}</style>
        <BackLink onBack={onBack} />
        <div className="lw-learn__loading"><LoaderCircle size={18} className="lw-learn__spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>
      <BackLink onBack={onBack} />
      <div className="lw-eyebrow">Course</div>
      <h1>{data.productTitle}</h1>

      {data.units.length === 0 && (
        <div className="lw-learn__empty">
          <BookOpen size={26} />
          <h2>Nothing here yet</h2>
          <p>This course doesn't have any published lessons yet — check back later.</p>
        </div>
      )}

      <div className="lw-learn__units">
        {data.units.map((u, i) => (
          <div className="lw-learn__unit" key={u.position}>
            <div className="lw-learn__unithead">
              <span className="lw-learn__unitnum">{i + 1}</span> {u.title}
            </div>
            <div className="lw-learn__lessonlist">
              {u.lessons.map((l) => {
                const done = l.progressStatus === "Completed";
                return (
                  <button className="lw-learn__lessonrow" key={l.id} onClick={() => onOpenLesson(l.id)}>
                    {done ? <CheckCircle2 size={15} className="is-done" /> : <PlayCircle size={15} />}
                    <span className="lw-learn__lessontitle">{l.title}</span>
                    {l.estimatedMinutes != null && <span className="lw-learn__mins">{l.estimatedMinutes} min</span>}
                    {done && <span className="lw-learn__donepill">{human("Completed")}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BackLink({ onBack }) {
  return (
    <button className="lw-learn__back" onClick={onBack}>
      <ArrowLeft size={13} /> All courses
    </button>
  );
}

const CSS = `
  .lw-learn__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-learn__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm);
    padding: 10px 13px; margin-bottom: 16px; font-size: 0.87rem;
  }
  .lw-learn__back {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none; color: var(--ink-soft);
    font-family: var(--font-body); font-size: 0.82rem; cursor: pointer; padding: 0; margin-bottom: 14px;
  }
  .lw-learn__back:hover { color: var(--ink); }

  .lw-learn__empty {
    text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 34px 26px; margin-bottom: 18px;
  }
  .lw-learn__empty h2 { font-family: var(--font-display); font-size: 1.05rem; color: var(--ink); margin: 10px 0 6px; }
  .lw-learn__empty p { font-size: 0.86rem; max-width: 46ch; margin: 0 auto; line-height: 1.6; }

  .lw-learn__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
  .lw-learn__card {
    display: flex; flex-direction: column; text-align: left; cursor: pointer; padding: 0;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    overflow: hidden; font-family: var(--font-body);
  }
  .lw-learn__card:hover:not(:disabled) { border-color: var(--accent); }
  .lw-learn__card:disabled { opacity: 0.55; cursor: not-allowed; }
  .lw-learn__cover { height: 84px; position: relative; display: flex; align-items: center; justify-content: center; }
  .lw-learn__monogram { font-family: var(--font-display); font-size: 1.8rem; font-weight: 600; color: rgba(255,255,255,0.92); }
  .lw-cover--0 { background: linear-gradient(135deg, #2D5BD1, #6D3FC4); }
  .lw-cover--1 { background: linear-gradient(135deg, #1E7F63, #5B8DEF); }
  .lw-cover--2 { background: linear-gradient(135deg, #E0A83E, #C4533F); }
  .lw-cover--3 { background: linear-gradient(135deg, #0EA5A5, #6D3FC4); }
  .lw-cover--4 { background: linear-gradient(135deg, #D1477A, #E0A83E); }
  .lw-learn__cardbody { padding: 11px 13px 13px; display: flex; flex-direction: column; gap: 6px; }
  .lw-learn__cardtitle { font-weight: 600; font-size: 0.92rem; color: var(--ink); }
  .lw-learn__carddesc { font-size: 0.82rem; color: var(--ink-soft); margin: 0; line-height: 1.5; }
  .lw-learn__cardnote { font-size: 0.76rem; color: var(--ink-soft); font-style: italic; }

  .lw-learn__units { display: flex; flex-direction: column; gap: 14px; }
  .lw-learn__unit { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; }
  .lw-learn__unithead { display: flex; align-items: center; gap: 9px; font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin-bottom: 10px; }
  .lw-learn__unitnum {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    background: var(--surface-2); color: var(--ink-soft);
    display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 11px;
  }
  .lw-learn__lessonlist { display: flex; flex-direction: column; gap: 6px; }
  .lw-learn__lessonrow {
    display: flex; align-items: center; gap: 9px; text-align: left; width: 100%;
    background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm);
    padding: 9px 12px; cursor: pointer; font-family: var(--font-body); color: var(--ink);
  }
  .lw-learn__lessonrow:hover { border-color: var(--accent); }
  .lw-learn__lessonrow svg { color: var(--ink-soft); flex-shrink: 0; }
  .lw-learn__lessonrow svg.is-done { color: var(--accent-2); }
  .lw-learn__lessontitle { flex: 1; font-size: 0.87rem; font-weight: 500; }
  .lw-learn__mins { font-family: var(--font-mono); font-size: 10px; color: var(--ink-soft); }
  .lw-learn__donepill {
    font-family: var(--font-mono); font-size: 10px; border-radius: 20px; padding: 3px 9px;
    background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2);
  }
`;
