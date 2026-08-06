import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, Check, Circle, ArrowRight, Globe, Lock, Rocket } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

/* =========================================================================
   WORKSPACE SETUP — the owner's own journey.

   Picks up where platform provisioning stops: the admin hands over a Workspace
   in Created and takes no further part (Platform Administrator Business
   Analysis §7). Everything from here to open-for-learners is the owner's.

   The server decides which single transition is available and returns it with
   every response, so this screen never re-derives the ordered lifecycle — it
   renders whatever the API says comes next (Workspace Setup Business
   Analysis, BA-004: the lifecycle is strictly ordered).
   ========================================================================= */

/** The five states an owner drives through, in order (Workspace Aggregate Design §15). */
const JOURNEY = [
  { status: "Created",     label: "Handed over",   blurb: "The workspace is yours. Nothing configured yet." },
  { status: "Configuring", label: "Configuring",   blurb: "Filling in the details that make it yours." },
  { status: "Private",     label: "Private",       blurb: "Ready to work in. Nobody outside can find it." },
  { status: "Published",   label: "Published",     blurb: "Publicly discoverable at its address." },
  { status: "Active",      label: "Open",          blurb: "Open for business — learners can enrol." },
];

const ACTION_LABEL = {
  BeginConfiguration: "Start setting up",
  MakePrivate:        "Mark configuration complete",
  Publish:            "Publish workspace",
  Activate:           "Open for business",
};

const ACTION_PATH = {
  BeginConfiguration: "begin-configuration",
  MakePrivate:        "make-private",
  Publish:            "publish",
  Activate:           "activate",
};

/** What each action actually does, so the owner isn't guessing before clicking. */
const ACTION_BLURB = {
  BeginConfiguration: "Moves the workspace into configuration so you can fill in its details.",
  MakePrivate:        "Marks it ready to work in. You and your members can use it; the public still can't see it.",
  Publish:            "Makes it publicly discoverable at its address. You can still change details afterwards.",
  Activate:           "Declares you're open. This is separate from being findable — it's you saying you're ready for learners.",
};

export default function WorkspaceSetupScreen() {
  const { session, workspace, refreshProfile } = useAuth();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => api.getSetup(session.token, slug)
      .then((d) => { setSetup(d); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    api.getSetup(session.token, slug)
      .then((d) => { if (!cancelled) { setSetup(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  async function act(fn) {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next) setSetup(next);   // every endpoint returns the whole state

      /* The workspace name and slug the chrome renders were snapshotted at
         sign-in. Renaming here without this leaves the sidebar and account bar
         calling the workspace something the owner just stopped calling it. */
      await refreshProfile();
      return next;
    } catch (e) {
      setError(e.message);
      await load();               // resync after a rejected transition
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (error && !setup) {
    return <div className="lw-page"><div className="lw-setup__alert"><AlertCircle size={16} /> {error}</div></div>;
  }
  if (!setup) {
    return (
      <div className="lw-page">
        <div className="lw-setup__loading"><LoaderCircle size={18} className="lw-setup__spin" /> Loading setup…</div>
      </div>
    );
  }

  const currentIndex = JOURNEY.findIndex((s) => s.status === setup.status);
  const next = setup.nextTransition;

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">Workspace Setup</div>
      <h1>{setup.name}</h1>
      <p className="lw-sub">
        Getting {setup.name} from handed-over to open for learners. Each step
        unlocks the next.
      </p>

      {error && <div className="lw-setup__alert"><AlertCircle size={16} /> {error}</div>}

      {/* ── Journey ─────────────────────────────────────────────────────── */}
      <ol className="lw-setup__journey">
        {JOURNEY.map((step, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          return (
            <li key={step.status} className={`lw-setup__step is-${state}`}>
              <span className="lw-setup__dot">
                {state === "done" ? <Check size={12} /> : <Circle size={8} />}
              </span>
              <span className="lw-setup__steptext">
                <span className="lw-setup__steplabel">{step.label}</span>
                <span className="lw-setup__stepblurb">{step.blurb}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Suspended and Archived are platform-driven and sit outside the journey */}
      {currentIndex === -1 && (
        <div className="lw-setup__alert">
          <AlertCircle size={16} /> This workspace is {setup.status}. {setup.blocker}
        </div>
      )}

      {/* ── The one available action ────────────────────────────────────── */}
      {setup.canManage && next && (
        <div className="lw-setup__action">
          <div>
            <div className="lw-setup__actiontitle">{ACTION_LABEL[next] ?? next}</div>
            <p>{ACTION_BLURB[next]}</p>
          </div>
          <button
            className="lw-btn lw-btn--accent"
            disabled={busy}
            onClick={() => act(() => api.workspaceTransition(session.token, slug, ACTION_PATH[next]))}
          >
            {busy ? <LoaderCircle size={15} className="lw-setup__spin" /> : <>{ACTION_LABEL[next]} <ArrowRight size={15} /></>}
          </button>
        </div>
      )}

      {setup.canManage && !next && setup.blocker && (
        <div className="lw-setup__blocked"><AlertCircle size={15} /> {setup.blocker}</div>
      )}

      {setup.canManage && !next && !setup.blocker && setup.status === "Active" && (
        <div className="lw-setup__done">
          <Rocket size={16} /> {setup.name} is open. Learners can enrol.
        </div>
      )}

      {/* ── Identity ────────────────────────────────────────────────────── */}
      <h2 className="lw-sectiontitle">Workspace identity</h2>
      {editing ? (
        <IdentityForm
          setup={setup}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            const saved = await act(() => api.updateWorkspaceIdentity(session.token, slug, body));
            if (saved) setEditing(false);
          }}
        />
      ) : (
        <div className="lw-setup__identity">
          <Field label="Name" value={setup.name} />
          <Field label="Public identifier" value={`/${setup.slug}`} mono />
          <Field label="Description" value={setup.description || "— not set —"} muted={!setup.description} />
          {setup.canManage && (
            <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      )}

      {/* Renaming after publication changes the address people already have */}
      {setup.status === "Published" || setup.status === "Active" ? (
        <p className="lw-setup__note">
          <Globe size={13} /> This workspace is discoverable at <code>/{setup.slug}</code>.
          Changing the identifier changes that address.
        </p>
      ) : (
        <p className="lw-setup__note">
          <Lock size={13} /> Not publicly discoverable yet.
        </p>
      )}

      {!setup.canManage && (
        <p className="lw-setup__readonly">
          You're viewing this. Only an owner or administrator can change setup.
        </p>
      )}
    </div>
  );
}

function Field({ label, value, mono, muted }) {
  return (
    <div className="lw-setup__field">
      <span className="lw-setup__fieldlabel">{label}</span>
      <span className={`lw-setup__fieldvalue ${mono ? "is-mono" : ""} ${muted ? "is-muted" : ""}`}>{value}</span>
    </div>
  );
}

function IdentityForm({ setup, onSubmit, onCancel, busy }) {
  const [name, setName] = useState(setup.name);
  const [slug, setSlug] = useState(setup.slug);
  const [description, setDescription] = useState(setup.description ?? "");

  return (
    <form
      className="lw-setup__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), slug: slug.trim(), description: description.trim() || null });
      }}
    >
      <label>
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus disabled={busy} />
      </label>
      <label>
        <span>Public identifier</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          required disabled={busy}
        />
      </label>
      <label className="lw-setup__wide">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
      </label>
      <div className="lw-setup__formactions">
        <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !name.trim() || !slug.trim()}>
          {busy ? <LoaderCircle size={14} className="lw-setup__spin" /> : "Save"}
        </button>
      </div>
    </form>
  );
}

const CSS = `
  .lw-setup__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }
  .lw-setup__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm);
    padding: 10px 13px; margin-bottom: 18px; font-size: 0.87rem;
  }

  .lw-setup__journey { list-style: none; padding: 0; margin: 0 0 24px; }
  .lw-setup__step { display: flex; gap: 12px; padding: 0 0 16px; position: relative; }
  .lw-setup__step:not(:last-child)::before {
    content: ""; position: absolute; left: 10px; top: 22px; bottom: 2px;
    width: 1px; background: var(--line);
  }
  .lw-setup__step.is-done::before { background: var(--accent-2); }
  .lw-setup__dot {
    width: 21px; height: 21px; border-radius: 50%; flex-shrink: 0; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-setup__step.is-done .lw-setup__dot { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-setup__step.is-current .lw-setup__dot { background: var(--accent); border-color: var(--accent); color: #fff; }
  .lw-setup__steplabel { display: block; font-weight: 600; font-size: 0.9rem; }
  .lw-setup__step.is-todo .lw-setup__steplabel { color: var(--ink-soft); }
  .lw-setup__stepblurb { display: block; font-size: 0.8rem; color: var(--ink-soft); margin-top: 2px; }

  .lw-setup__action {
    display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-sm); padding: 16px 18px; margin-bottom: 8px;
  }
  .lw-setup__actiontitle { font-weight: 600; font-size: 0.95rem; }
  .lw-setup__action p { font-size: 0.83rem; color: var(--ink-soft); margin: 4px 0 0; max-width: 58ch; line-height: 1.55; }

  .lw-setup__blocked, .lw-setup__done {
    display: flex; align-items: center; gap: 9px; font-size: 0.87rem;
    border-radius: var(--radius-sm); padding: 12px 15px; margin-bottom: 8px;
  }
  .lw-setup__blocked { background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
  .lw-setup__done { background: color-mix(in srgb, var(--accent-2) 12%, transparent); color: var(--accent-2); font-weight: 600; }

  .lw-setup__identity {
    display: flex; flex-direction: column; gap: 12px; align-items: flex-start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-setup__field { display: flex; gap: 14px; align-items: baseline; width: 100%; }
  .lw-setup__fieldlabel { font-size: 0.78rem; color: var(--ink-soft); min-width: 130px; flex-shrink: 0; }
  .lw-setup__fieldvalue { font-size: 0.92rem; }
  .lw-setup__fieldvalue.is-mono { font-family: var(--font-mono); font-size: 0.85rem; }
  .lw-setup__fieldvalue.is-muted { color: var(--ink-soft); font-style: italic; }

  /* UIC-003: one property per row — label left, value right — matching
     .lw-setup__field's own read-only row layout above. */
  .lw-setup__form {
    display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 16px 18px;
  }
  .lw-setup__form > label { display: contents; }
  .lw-setup__form label > span:first-child { font-size: 0.78rem; font-weight: 600; padding-top: 9px; white-space: nowrap; }
  .lw-setup__form input, .lw-setup__form textarea {
    width: 100%; font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 9px 11px; resize: vertical;
  }
  .lw-setup__formactions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }
  @media (max-width: 560px) {
    .lw-setup__form { grid-template-columns: 1fr; }
    .lw-setup__form > label { display: flex; flex-direction: column; gap: 5px; }
    .lw-setup__form label > span:first-child { padding-top: 0; white-space: normal; }
  }

  .lw-setup__note {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 12px;
  }
  .lw-setup__note code { font-family: var(--font-mono); }
  .lw-setup__readonly { font-size: 0.83rem; color: var(--ink-soft); margin-top: 16px; font-style: italic; }

  .lw-setup__spin { animation: lwSetupSpin 0.9s linear infinite; }
  @keyframes lwSetupSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-setup__spin { animation: none; } }
`;
