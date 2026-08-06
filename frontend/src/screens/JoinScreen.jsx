import { useEffect, useState } from "react";
import { LoaderCircle, AlertCircle, CheckCircle2, ArrowRight, Building2, Clock } from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";
import InfoTip from "../components/InfoTip";
import RequiredMark, { invalidFieldStyle } from "../components/RequiredMark";

/* =========================================================================
   JOIN SCREEN — /join/{slug}

   Reached only through a link the Workspace shared itself. The platform never
   helps anyone find this page: there is no directory, search or browse, by
   permanent decision (Join Request BA-007, ADR-EA-002) — providing discovery
   would put the platform in competition with its own paying customers for
   their students' attention.

   Anonymous by necessity: a stranger has no account yet, and requiring one
   first would be circular (BA-003). Submitting therefore creates their
   Identity — which is why the endpoint behind this form is the one carrying a
   rate limit.
   ========================================================================= */

export default function JoinScreen({ slug, onJoined, onSignIn }) {
  useFonts();
  const { adoptSession } = useAuth();

  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.previewJoin(slug)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [slug]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!fullName.trim() || !email.trim() || !password) {
      setAttempted(true);
      setError("Fill in your name, email and password before sending — all three are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const session = await api.submitJoin(slug, {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        message: message.trim() || null,
      });
      // Through the provider, not straight to storage — see AuthProvider's
      // adoptSession: a session written behind its back is invisible to it,
      // and any previously signed-in person would silently remain current.
      adoptSession({
        token: session.token,
        expiresAt: session.expiresAt,
        fullName: session.fullName,
      });
      setDone(true);
      setTimeout(() => onJoined(), 1600);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Shell>
        <div className="pl-join__card pl-join__card--bad">
          <AlertCircle size={26} aria-hidden="true" />
          <h1>This link doesn't work</h1>
          <p>{loadError}</p>
          <p className="pl-join__muted">
            Academies are reached through their own link. If yours isn't working,
            ask whoever shared it with you.
          </p>
        </div>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="pl-join__card">
          <LoaderCircle size={22} className="pl-join__spin" aria-hidden="true" />
          <p className="pl-join__muted">Loading…</p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="pl-join__card pl-join__card--good">
          <CheckCircle2 size={26} aria-hidden="true" />
          <h1>Request sent</h1>
          <p>{preview.workspaceName} will decide whether to let you in. You'll see the outcome on your account.</p>
        </div>
      </Shell>
    );
  }

  // BA-005: accepting requests is off by default. A workspace that hasn't
  // opted in is a normal, expected state — not an error.
  if (!preview.acceptingRequests) {
    return (
      <Shell>
        <div className="pl-join__card">
          <div className="pl-join__mark" aria-hidden="true"><Building2 size={22} /></div>
          <h1>{preview.workspaceName}</h1>
          <p className="pl-join__lead">This academy isn't taking open requests.</p>
          <p className="pl-join__muted">
            You'll need an invitation from someone who teaches here. If you're
            expecting one, check your email — and if you already have an account,
            you can sign in.
          </p>
          <button className="pl-join__ghost" onClick={onSignIn}>Sign in</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="pl-join__card">
        <div className="pl-join__mark" aria-hidden="true"><Building2 size={22} /></div>
        <div className="pl-join__eyebrow">Request to join</div>
        <h1>{preview.workspaceName}</h1>
        {preview.description && <p className="pl-join__lead">{preview.description}</p>}

        <form className="pl-join__form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="pl-join__alert" role="alert">
              <AlertCircle size={16} aria-hidden="true" /> <span>{error}</span>
            </div>
          )}

          <label className="pl-join__field">
            <span>Your name<RequiredMark /></span>
            <input type="text" autoComplete="name" required autoFocus
                   value={fullName} onChange={(e) => { setFullName(e.target.value); setError(null); }}
                   placeholder="Alex Morgan" disabled={submitting}
                   style={attempted && !fullName.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-join__field">
            <span>Email<RequiredMark /></span>
            <input type="email" autoComplete="email" required
                   value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   placeholder="you@example.com" disabled={submitting}
                   style={attempted && !email.trim() ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-join__field">
            <span>Password<RequiredMark /> <InfoTip text="If you already have an account with this email, enter its existing password." /></span>
            <input type="password" autoComplete="new-password" required
                   value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
                   placeholder="••••••••" disabled={submitting}
                   style={attempted && !password ? invalidFieldStyle : undefined} />
          </label>

          <label className="pl-join__field">
            <span>Anything you'd like them to know</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                      placeholder="A little about why you'd like to join…" disabled={submitting} />
          </label>

          <button type="submit" className="pl-join__btn" disabled={submitting}>
            {submitting
              ? (<><LoaderCircle size={16} className="pl-join__spin" aria-hidden="true" /> Sending…</>)
              : (<>Send request <ArrowRight size={16} aria-hidden="true" /></>)}
          </button>
        </form>

        <p className="pl-join__muted">
          <Clock size={13} aria-hidden="true" /> Requests are read by the people who run this
          academy. Joining doesn't enrol you in anything yet.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="pl-join"><style>{CSS}</style>{children}</div>;
}

const CSS = `
  .pl-join {
    --ink: #1B2430; --ink-soft: #6A7383; --line: #E1DED7; --accent: #2D5BD1;
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: #F7F5F1; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 40px 22px;
  }
  .pl-join *, .pl-join *::before, .pl-join *::after { box-sizing: border-box; }

  .pl-join__card {
    width: 100%; max-width: 460px; background: #fff;
    border: 1px solid var(--line); border-radius: 16px; padding: 34px 30px; text-align: center;
  }
  .pl-join__card--bad { border-color: rgba(179,56,43,0.3); color: #B3382B; }
  .pl-join__card--good { border-color: rgba(30,127,99,0.35); color: #1E7F63; }
  .pl-join__card--bad h1, .pl-join__card--good h1 { color: inherit; }

  .pl-join__mark {
    width: 48px; height: 48px; border-radius: 13px; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
  }
  .pl-join__eyebrow {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px;
  }
  .pl-join h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.6rem; font-weight: 600; margin: 0 0 8px; line-height: 1.15; }
  .pl-join__lead { color: var(--ink-soft); font-size: 0.92rem; line-height: 1.6; margin: 0 0 22px; }

  /* UIC-003: one property per row — label left, value right. The card
     around this form is text-align: center (for its centered header); this
     grid overrides back to left, same override .pl-join__field always did. */
  .pl-join__form { display: grid; grid-template-columns: max-content 1fr; row-gap: 16px; column-gap: 14px; align-items: start; text-align: left; }
  .pl-join__form > .pl-join__field { display: contents; }
  .pl-join__field > span:first-child { font-size: 0.82rem; font-weight: 600; padding-top: 11px; white-space: nowrap; }
  .pl-join__field em { font-style: normal; font-weight: 400; color: var(--ink-soft); }
  .pl-join__field input, .pl-join__field textarea {
    width: 100%; font-family: inherit; font-size: 0.95rem; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 10px;
    padding: 11px 13px; resize: vertical;
  }
  .pl-join__form > .pl-join__alert, .pl-join__form > .pl-join__btn { grid-column: 1 / -1; }
  @media (max-width: 480px) {
    .pl-join__form { grid-template-columns: 1fr; }
    .pl-join__form > .pl-join__field { display: flex; flex-direction: column; gap: 6px; }
    .pl-join__field > span:first-child { padding-top: 0; white-space: normal; }
  }
  .pl-join__field input:focus-visible, .pl-join__field textarea:focus-visible {
    outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(45,91,209,0.16);
  }

  .pl-join__btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: inherit; font-size: 0.95rem; font-weight: 600;
    color: #fff; background: var(--accent); border: none; border-radius: 10px;
    padding: 12px 16px; cursor: pointer; margin-top: 4px;
  }
  .pl-join__btn:hover:not(:disabled) { background: #2449AC; }
  .pl-join__btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .pl-join__ghost {
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: var(--accent); background: transparent;
    border: 1px solid var(--line); border-radius: 9px; padding: 9px 18px; cursor: pointer; margin-top: 6px;
  }
  .pl-join__ghost:hover { border-color: var(--accent); }

  .pl-join__alert {
    display: flex; align-items: flex-start; gap: 9px; text-align: left;
    background: #FDF1EF; border: 1px solid rgba(179,56,43,0.28); color: #B3382B;
    border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; font-size: 0.87rem;
  }
  .pl-join__alert svg { flex-shrink: 0; margin-top: 1px; }

  .pl-join__muted {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    font-size: 0.79rem; color: var(--ink-soft); margin: 18px 0 0; line-height: 1.55;
  }

  .pl-join__spin { animation: plJoinSpin 0.9s linear infinite; }
  @keyframes plJoinSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-join__spin { animation: none; } }
`;
