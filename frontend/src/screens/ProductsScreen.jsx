import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, RefreshCw, Send, Undo2,
  Globe, Archive, Pencil, BookOpen, Layers, X,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import InfoTip from "../components/InfoTip";

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

/* Definitions from Learning Product Aggregate Design §8. Shown in the form
   because the values are not self-explanatory — the difference between
   cohort-based and instructor-led in particular is a real judgement, and a
   tutor picking blind will pick inconsistently. */
const PACING = [
  { value: "SelfPaced",
    help: "The learner sets the pace. Enrol any time, work through at whatever speed suits — no shared dates, nobody to wait for." },
  { value: "CohortBased",
    help: "A shared schedule sets the pace. A group starts together on a set date and moves through in step; joining late means missing something." },
  { value: "InstructorLed",
    help: "You set the pace, per learner. You decide what happens next and when, usually in sessions arranged with them. Closest to one-to-one tutoring." },
];

const ENROLLMENT = [
  { value: "Open",             help: "Anyone who can reach the product can enrol themselves." },
  { value: "InvitationOnly",   help: "You choose who gets in; nobody can enrol unprompted." },
  { value: "ApprovalRequired", help: "Learners ask to join and you approve each one." },
];

/** Which transitions each status offers, mirroring §16's ordered machine. */
const ACTIONS = {
  Draft:       [{ key: "submit", label: "Submit for review", icon: Send },
                { key: "publish", label: "Publish", icon: Globe }],
  UnderReview: [{ key: "publish", label: "Publish", icon: Globe },
                { key: "return", label: "Back to draft", icon: Undo2 }],
  Published:   [{ key: "unpublish", label: "Unpublish", icon: Undo2 }],
  Archived:    [],
};

const human = (s) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

/** A small, fixed palette so each product gets a stable "cover" color from its id — no image upload exists yet. */
const COVER_VARIANTS = 5;
function coverVariant(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return hash % COVER_VARIANTS;
}

export default function ProductsScreen({ onOpenStudio }) {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);   // product being edited, or "new"

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

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { const r = await fn(); await load(); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  if (error && !data) {
    return <div className="lw-page"><div className="lw-prod__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!data) {
    return (
      <div className="lw-page">
        <div className="lw-prod__loading"><LoaderCircle size={18} className="lw-prod__spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">Learning Product Context</div>
      <h1>Learning products</h1>
      <p className="lw-sub">
        What {data.workspaceName} offers. A product is the thing a learner enrols
        in — its curriculum, the units and lessons a learner actually works
        through, is built separately in Content Studio.
      </p>

      {error && <div className="lw-prod__alert"><AlertCircle size={16} /> {error}</div>}

      {data.canAuthor && (
        <div className="lw-prod__bar">
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> New product
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {editing && (
        <div className="lw-prod__overlay" role="dialog" aria-modal="true" onClick={() => setEditing(null)}>
          <div className="lw-prod__panel" onClick={(e) => e.stopPropagation()}>
            <button className="lw-prod__panelclose" onClick={() => setEditing(null)} aria-label="Close"><X size={16} /></button>
            <div className="lw-eyebrow">{editing === "new" ? "New product" : "Edit product"}</div>
            <h2 className="lw-prod__panelh2">{editing === "new" ? "Create a learning product" : editing.title}</h2>
            <ProductForm
              busy={busy}
              product={editing === "new" ? null : editing}
              onCancel={() => setEditing(null)}
              onSubmit={async (body) => {
                const saved = await run(() => editing === "new"
                  ? api.createProduct(session.token, slug, body)
                  : api.updateProduct(session.token, slug, editing.id, body));
                if (saved) setEditing(null);
              }}
            />
          </div>
        </div>
      )}

      {data.products.length === 0 && (
        <div className="lw-prod__empty">
          <BookOpen size={26} />
          <h2>Nothing offered yet</h2>
          <p>
            {data.canAuthor
              ? "Create your first product — a course, a programme, whatever you teach. You only need a title to start."
              : "This workspace hasn't defined any learning products yet."}
          </p>
        </div>
      )}

      <div className="lw-prod__grid">
        {data.products.map((p) => {
          return (
            <div className={`lw-prod__card is-${p.status.toLowerCase()}`} key={p.id}>
              <div className={`lw-prod__cover lw-cover--${coverVariant(p.id)}`}>
                <span className="lw-prod__monogram">{(p.title.trim()[0] ?? "?").toUpperCase()}</span>
                <span className={`lw-prod__pill is-${p.status.toLowerCase()}`}>{human(p.status)}</span>
              </div>

              <div className="lw-prod__body">
                <div className="lw-prod__title">{p.title}</div>

                {/* Display only — one property per row, label in its own column. */}
                <div className="lw-prod__proplist">
                  <span className="lw-prod__proplabel">📝 Description</span>
                  {p.description
                    ? <span className="lw-prod__propvalue">{p.description}</span>
                    : <span className="lw-prod__propvalue is-empty">No description yet</span>}

                  <span className="lw-prod__proplabel">🕒 Pacing</span>
                  <span className="lw-prod__propvalue">{human(p.pacing)}</span>

                  <span className="lw-prod__proplabel">🔓 Enrollment</span>
                  <span className="lw-prod__propvalue">{human(p.enrollmentMode)}</span>

                  {p.category && (
                    <>
                      <span className="lw-prod__proplabel">🏷️ Category</span>
                      <span className="lw-prod__propvalue">{p.category}</span>
                    </>
                  )}

                  {p.defaultLanguage && (
                    <>
                      <span className="lw-prod__proplabel">🌐 Language</span>
                      <span className="lw-prod__propvalue">{p.defaultLanguage}</span>
                    </>
                  )}

                  {p.tags.length > 0 && (
                    <>
                      <span className="lw-prod__proplabel">🔖 Tags</span>
                      <span className="lw-prod__propvalue">{p.tags.join(", ")}</span>
                    </>
                  )}

                  <span className="lw-prod__proplabel">📚 Curriculum</span>
                  {p.hasCurriculum
                    ? <span className="lw-prod__propvalue is-ready">Published</span>
                    : <span className="lw-prod__propvalue is-empty">Not published yet</span>}
                </div>
              </div>

              {data.canAuthor && p.status !== "Archived" && (
                <div className="lw-prod__actions">
                  <button disabled={busy} onClick={() => setEditing(p)}><Pencil size={12} /> Edit</button>
                  {onOpenStudio && (
                    <button disabled={busy} onClick={() => onOpenStudio(p.id)}>
                      <Layers size={12} /> {p.hasCurriculum ? "Curriculum" : "Build curriculum"}
                    </button>
                  )}
                  {(ACTIONS[p.status] ?? []).map((a) => (
                    <button key={a.key} disabled={busy}
                            onClick={() => run(() => api.productTransition(session.token, slug, p.id, a.key))}>
                      <a.icon size={12} /> {a.label}
                    </button>
                  ))}
                  <button disabled={busy}
                          onClick={() => run(() => api.productTransition(session.token, slug, p.id, "archive"))}>
                    <Archive size={12} /> Archive
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!data.canAuthor && data.products.length > 0 && (
        <p className="lw-prod__readonly">
          You're viewing this list. Only an owner, administrator or teacher can create or change products.
        </p>
      )}
    </div>
  );
}

function ProductForm({ product, onSubmit, onCancel, busy }) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [tags, setTags] = useState((product?.tags ?? []).join(", "));
  const [pacing, setPacing] = useState(product?.pacing ?? "SelfPaced");
  const [enrollmentMode, setEnrollmentMode] = useState(product?.enrollmentMode ?? "Open");
  const [defaultLanguage, setDefaultLanguage] = useState(product?.defaultLanguage ?? "");

  return (
    <form
      className="lw-prod__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          pacing, enrollmentMode,
          defaultLanguage: defaultLanguage.trim() || null,
        });
      }}
    >
      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
               placeholder="Everyday Conversation A2" disabled={busy} />
      </label>
      <label>
        <span>Description <em>(optional)</em></span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Who it's for and what they'll come away with." disabled={busy} />
      </label>
      <label>
        <span>Pacing <InfoTip text={PACING.find((p) => p.value === pacing)?.help} /></span>
        <select value={pacing} onChange={(e) => setPacing(e.target.value)} disabled={busy}>
          {PACING.map((p) => <option key={p.value} value={p.value}>{human(p.value)}</option>)}
        </select>
      </label>
      <label>
        <span>How learners get in <InfoTip text={ENROLLMENT.find((m) => m.value === enrollmentMode)?.help} /></span>
        <select value={enrollmentMode} onChange={(e) => setEnrollmentMode(e.target.value)} disabled={busy}>
          {ENROLLMENT.map((m) => <option key={m.value} value={m.value}>{human(m.value)}</option>)}
        </select>
      </label>
      <label>
        <span>Category <em>(optional)</em></span>
        <input value={category} onChange={(e) => setCategory(e.target.value)}
               placeholder="Languages" disabled={busy} />
      </label>
      <label>
        <span>Language <em>(optional)</em></span>
        <input value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}
               placeholder="English" disabled={busy} />
      </label>
      <label>
        <span>Tags <em>(comma separated, optional)</em></span>
        <input value={tags} onChange={(e) => setTags(e.target.value)}
               placeholder="beginner, conversation, evenings" disabled={busy} />
      </label>

      <div className="lw-prod__formactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !title.trim()}>
          {busy ? <LoaderCircle size={14} className="lw-prod__spin" /> : product ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}

const CSS = `
  .lw-prod__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-prod__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm);
    padding: 10px 13px; margin-bottom: 16px; font-size: 0.87rem;
  }
  .lw-prod__bar { display: flex; gap: 8px; margin-bottom: 18px; }

  .lw-prod__form { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .lw-prod__form label span { display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 5px; }
  .lw-prod__form em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .lw-prod__form input, .lw-prod__form textarea, .lw-prod__form select {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }
  .lw-prod__formactions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }

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
  .lw-prod__cover .lw-prod__pill { position: absolute; top: 9px; right: 9px; background: rgba(10,12,15,0.4); color: #fff; }
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
  .lw-prod__panelclose { position: absolute; top: 18px; right: 18px; background: transparent; border: none; cursor: pointer; color: var(--ink-soft); }
  .lw-prod__panelclose:hover { color: var(--ink); }
  .lw-prod__panelh2 { margin: 2px 0 18px; }

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

  .lw-prod__empty {
    text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px dashed var(--line);
    border-radius: var(--radius-sm); padding: 40px 26px;
  }
  .lw-prod__empty h2 { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin: 12px 0 8px; }
  .lw-prod__empty p { font-size: 0.88rem; max-width: 46ch; margin: 0 auto; line-height: 1.6; }
  .lw-prod__readonly { font-size: 0.83rem; color: var(--ink-soft); margin-top: 16px; font-style: italic; }

  .lw-prod__spin { animation: lwProdSpin 0.9s linear infinite; }
  @keyframes lwProdSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-prod__spin { animation: none; } }
`;
