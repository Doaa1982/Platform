import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, RefreshCw, Send, Undo2,
  Globe, Archive, Pencil, BookOpen,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

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

export default function ProductsScreen() {
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
        in — the teaching material inside it is a separate concern, and isn't
        built yet.
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
      )}

      {data.products.length === 0 && !editing && (
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

      <div className="lw-prod__list">
        {data.products.map((p) => (
          <div className={`lw-prod__row is-${p.status.toLowerCase()}`} key={p.id}>
            <div className="lw-prod__body">
              <div className="lw-prod__title">
                {p.title}
                <span className={`lw-prod__pill is-${p.status.toLowerCase()}`}>{human(p.status)}</span>
              </div>
              {p.description && <p className="lw-prod__desc">{p.description}</p>}
              <div className="lw-prod__meta">
                <span>{human(p.pacing)}</span>
                <span>{human(p.enrollmentMode)}</span>
                {p.category && <span>{p.category}</span>}
                {p.tags.map((t) => <span className="lw-prod__tag" key={t}>{t}</span>)}
              </div>
              {/* The honest part: an offer with nothing behind it yet */}
              {!p.hasCurriculum && (
                <div className="lw-prod__nocurr">
                  No teaching content — lessons and curriculum aren't built yet, so
                  {p.status === "Published" ? " this is an announced offer rather than something a learner can take." : " there's nothing inside this product."}
                </div>
              )}
            </div>

            {data.canAuthor && p.status !== "Archived" && (
              <div className="lw-prod__actions">
                <button disabled={busy} onClick={() => setEditing(p)}><Pencil size={12} /> Edit</button>
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
        ))}
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
      <label className="lw-prod__wide">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
               placeholder="Everyday Conversation A2" disabled={busy} />
      </label>
      <label className="lw-prod__wide">
        <span>Description <em>(optional)</em></span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Who it's for and what they'll come away with." disabled={busy} />
      </label>
      {/* The help text follows the selection rather than sitting in a tooltip:
          this is a choice a tutor makes once and lives with, so the meaning
          should be readable without hunting for it. */}
      <label>
        <span>Pacing — what decides when a learner moves on</span>
        <select value={pacing} onChange={(e) => setPacing(e.target.value)} disabled={busy}>
          {PACING.map((p) => <option key={p.value} value={p.value}>{human(p.value)}</option>)}
        </select>
        <small>{PACING.find((p) => p.value === pacing)?.help}</small>
      </label>
      <label>
        <span>How learners get in</span>
        <select value={enrollmentMode} onChange={(e) => setEnrollmentMode(e.target.value)} disabled={busy}>
          {ENROLLMENT.map((m) => <option key={m.value} value={m.value}>{human(m.value)}</option>)}
        </select>
        <small>{ENROLLMENT.find((m) => m.value === enrollmentMode)?.help}</small>
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
      <label className="lw-prod__wide">
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

  .lw-prod__form {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 18px; margin-bottom: 18px;
  }
  .lw-prod__wide { grid-column: 1 / -1; }
  .lw-prod__form label span { display: block; font-size: 0.78rem; font-weight: 600; margin-bottom: 5px; }
  .lw-prod__form em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .lw-prod__form input, .lw-prod__form textarea, .lw-prod__form select {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }
  .lw-prod__form small {
    display: block; margin-top: 6px; font-size: 0.76rem;
    color: var(--ink-soft); line-height: 1.5;
  }
  .lw-prod__formactions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }

  .lw-prod__list { display: flex; flex-direction: column; gap: 9px; }
  .lw-prod__row {
    display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 15px 17px;
  }
  .lw-prod__row.is-archived { opacity: 0.55; }
  .lw-prod__body { flex: 1; min-width: 240px; }
  .lw-prod__title { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; font-weight: 600; font-size: 0.98rem; }
  .lw-prod__desc { font-size: 0.86rem; color: var(--ink-soft); margin: 6px 0 0; max-width: 62ch; line-height: 1.55; }
  .lw-prod__meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 9px; }
  .lw-prod__meta span {
    font-family: var(--font-mono); font-size: 10px;
    background: var(--surface-2); color: var(--ink-soft); border-radius: 20px; padding: 3px 8px;
  }
  .lw-prod__tag { background: color-mix(in srgb, var(--accent) 12%, transparent) !important; color: var(--accent) !important; }

  .lw-prod__pill {
    font-family: var(--font-mono); font-size: 10px; border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-prod__pill.is-published { background: color-mix(in srgb, var(--accent-2) 16%, transparent); color: var(--accent-2); }
  .lw-prod__pill.is-underreview { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

  .lw-prod__nocurr {
    font-size: 0.8rem; color: var(--ink-soft); font-style: italic;
    margin-top: 10px; padding-top: 9px; border-top: 1px dashed var(--line); max-width: 66ch; line-height: 1.5;
  }

  .lw-prod__actions { display: flex; gap: 5px; flex-wrap: wrap; flex-shrink: 0; }
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
  @media (max-width: 640px) { .lw-prod__form { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { .lw-prod__spin { animation: none; } }
`;
