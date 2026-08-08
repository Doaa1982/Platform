import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, Plus, RefreshCw, X, Copy, Check,
  ShieldAlert, LogOut, Building2, PauseCircle, PlayCircle, Archive,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";

/* =========================================================================
   ADMIN SCREEN — the Platform Administrator's console.

   The only surface in the app that is not Workspace-scoped. Its authority
   comes from a PlatformOperator grant, never from a Membership, so it can act
   on Workspaces it belongs to in no way at all (Platform Administrator
   Business Analysis, BA-001).

   The UI never decides who is an admin. Every call goes to the server, and a
   403 is rendered honestly as "you don't have access" rather than the surface
   being hidden client-side — hiding a button is not authorization.
   ========================================================================= */

/** Provisioning statuses where the admin has outstanding work (§9). */
const NEEDS_ACTION = new Set(["Awaiting Invitation", "Invitation Expired"]);

/** Application statuses still waiting on a reviewer's decision (§7.1). */
const AWAITING = new Set(["Submitted", "UnderReview"]);

/** ApprovedAwaitingPayment → "Approved — awaiting payment" */
function humanStatus(status) {
  return status
    .replace("ApprovedAwaitingPayment", "Approved — awaiting payment")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

export default function AdminScreen() {
  useFonts();
  const { session, me, signOut } = useAuth();

  const [rows, setRows] = useState(null);
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [provisionFor, setProvisionFor] = useState(null);  // the paid applicant being provisioned
  const [issued, setIssued] = useState(null);   // most recently created/resent link

  /* Used by the refresh button and after every mutation. State lands in the
     promise callbacks, never synchronously. */
  const load = useCallback(
    () => Promise.all([
      api.getProvisioningView(session.token),
      api.getSignupRequests(session.token),
    ])
      .then(([workspaces, signups]) => { setRows(workspaces); setApplications(signups); setError(null); })
      .catch((e) => {
        // 403 is not an error to retry — it is the answer. The account is
        // signed in but holds no PlatformOperator grant.
        if (e.status === 403) setDenied(true);
        else setError(e.message);
      }),
    [session.token]);

  // Initial load, inlined rather than calling load(), so nothing sets state
  // synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.getProvisioningView(session.token),
      api.getSignupRequests(session.token),
    ])
      .then(([workspaces, signups]) => {
        if (cancelled) return;
        setRows(workspaces); setApplications(signups); setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 403) setDenied(true);
        else setError(e.message);
      });

    return () => { cancelled = true; };
  }, [session.token]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      await load();
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <Shell>
        <div className="pl-admin__denied">
          <ShieldAlert size={28} aria-hidden="true" />
          <h1>Not a platform administrator</h1>
          <p>
            You're signed in as {me?.email}, but this account doesn't hold platform
            operator access. If that's wrong, ask an existing administrator to grant it.
          </p>
          <button className="pl-admin__btn" onClick={signOut}>Sign out</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="pl-admin__head">
        <div className="pl-admin__headtitle">
          <div className="pl-admin__eyebrow">Platform operations</div>
          <h1>Workspaces</h1>
        </div>
        <div className="pl-admin__headactions">
          <button className="pl-admin__ghost" onClick={load} disabled={busy}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          <button className="pl-admin__btn" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} aria-hidden="true" /> Provision workspace
          </button>
          <button className="pl-admin__ghost" onClick={signOut}>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>

      {error && (
        <div className="pl-admin__alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> <span>{error}</span>
        </div>
      )}

      {showForm && (
        <ProvisionForm
          busy={busy}
          onCancel={() => setShowForm(false)}
          onSubmit={async (body) => {
            const result = await run(() => api.provisionWorkspace(session.token, body));
            if (result) { setIssued(result); setShowForm(false); }
          }}
        />
      )}

      {issued && <IssuedLink issued={issued} onDismiss={() => setIssued(null)} />}

      {/* §7.1 — applications, which come before any workspace exists. Placed
          first because an unreviewed one is the platform's oldest outstanding
          work: nothing else can happen for that person until it's decided. */}
      {applications.length > 0 && (
        <section className="pl-admin__apps">
          <h2 className="pl-admin__h2">Tutor applications</h2>
          <div className="pl-admin__applist">
            {applications.map((a) => (
              <div key={a.id} className={`pl-admin__app ${AWAITING.has(a.status) ? "is-attention" : ""}`}>
                <div className="pl-admin__appwho">
                  <strong>{a.fullName}</strong>
                  <span>{a.email}</span>
                  {a.about && <p>{a.about}</p>}
                </div>
                <div className="pl-admin__appstate">
                  <span className={`pl-admin__pill ${AWAITING.has(a.status) ? "is-warn" : a.status === "Paid" ? "is-ok" : ""}`}>
                    {humanStatus(a.status)}
                  </span>
                  {a.payment !== "NotStarted" && <span className="pl-admin__pill">Payment: {a.payment}</span>}
                </div>
                <div className="pl-admin__actions">
                  {AWAITING.has(a.status) && (
                    <>
                      <button disabled={busy} onClick={() => run(() => api.approveSignup(session.token, a.id))}>
                        <Check size={12} /> Approve
                      </button>
                      <button disabled={busy}
                              onClick={() => run(() => api.rejectSignup(session.token, a.id, { reason: null, reasonVisible: false }))}>
                        <X size={12} /> Reject
                      </button>
                    </>
                  )}
                  {/* Paid but not yet provisioned — §7.2 stays admin-initiated (BA-004) */}
                  {a.status === "Paid" && !a.provisionedWorkspaceId && (
                    <button disabled={busy} onClick={() => setProvisionFor(a)}>
                      <Plus size={12} /> Provision workspace
                    </button>
                  )}
                  {a.provisionedWorkspaceId && <span className="pl-admin__muted">Provisioned</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {provisionFor && (
        <ProvisionForm
          busy={busy}
          applicant={provisionFor}
          onCancel={() => setProvisionFor(null)}
          onSubmit={async (body) => {
            const result = await run(() => api.provisionForSignup(session.token, provisionFor.id, body));
            if (result) { setIssued(result); setProvisionFor(null); }
          }}
        />
      )}

      {rows === null && (
        <div className="pl-admin__loading">
          <LoaderCircle size={20} className="pl-admin__spin" aria-hidden="true" /> Loading workspaces…
        </div>
      )}

      {rows?.length === 0 && (
        <div className="pl-admin__empty">
          <Building2 size={26} aria-hidden="true" />
          <p>No workspaces yet. Provision one to invite its first owner.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="pl-admin__tablewrap">
          <table className="pl-admin__table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Lifecycle</th>
                <th>Provisioning</th>
                <th>Members</th>
                <th>Invitation</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workspaceId} className={NEEDS_ACTION.has(r.provisioningStatus) ? "is-attention" : ""}>
                  <td>
                    <span className="pl-admin__wsname">{r.name}</span>
                    <span className="pl-admin__slug">/{r.slug}</span>
                  </td>
                  <td><span className="pl-admin__pill">{r.workspaceStatus}</span></td>
                  <td>
                    <span className={`pl-admin__pill ${NEEDS_ACTION.has(r.provisioningStatus) ? "is-warn" : "is-ok"}`}>
                      {r.provisioningStatus}
                    </span>
                  </td>
                  <td>{r.memberCount}</td>
                  <td>
                    {r.invitation ? (
                      <span className="pl-admin__inv">
                        {r.invitation.email}
                        <span className="pl-admin__invmeta">
                          {r.invitation.intendedRole} · {r.invitation.status}
                        </span>
                      </span>
                    ) : <span className="pl-admin__muted">—</span>}
                  </td>
                  <td className="pl-admin__actions">
                    {r.invitation && ["Sent", "Expired"].includes(r.invitation.status) && (
                      <>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            const res = await run(() => api.resendInvitation(session.token, r.invitation.id));
                            if (res) setIssued(res);
                          }}
                        >
                          <RefreshCw size={12} aria-hidden="true" /> Resend
                        </button>
                        {r.invitation.status === "Sent" && (
                          <button
                            disabled={busy}
                            onClick={() => run(() => api.cancelInvitation(session.token, r.invitation.id))}
                          >
                            <X size={12} aria-hidden="true" /> Cancel
                          </button>
                        )}
                      </>
                    )}
                    {r.workspaceStatus === "Active" && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "suspend"))}>
                        <PauseCircle size={12} aria-hidden="true" /> Suspend
                      </button>
                    )}
                    {r.workspaceStatus === "Suspended" && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "reinstate"))}>
                        <PlayCircle size={12} aria-hidden="true" /> Reinstate
                      </button>
                    )}
                    {!["Archived", "Deleted"].includes(r.workspaceStatus) && (
                      <button disabled={busy} onClick={() => run(() => api.workspaceAction(session.token, r.workspaceId, "archive"))}>
                        <Archive size={12} aria-hidden="true" /> Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

/* ── Provision form ──────────────────────────────────────────────────────── */

function ProvisionForm({ onSubmit, onCancel, busy, applicant }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Prefilled when provisioning for a specific applicant, so their email is
  // never retyped — and never mistyped — at the point it matters most
  const [ownerEmail, setOwnerEmail] = useState(applicant?.email ?? "");
  const [slugTouched, setSlugTouched] = useState(false);

  // Suggest a slug from the name until the admin edits it themselves
  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <form
      className="pl-admin__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name: name.trim(), slug: effectiveSlug, ownerEmail: ownerEmail.trim() });
      }}
    >
      <div className="pl-admin__formrow">
        <label>
          <span>Workspace name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Northwind Tutoring" required autoFocus disabled={busy} />
        </label>
        <label>
          <span>Slug</span>
          <input value={effectiveSlug}
                 onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                 placeholder="northwind-tutoring" required disabled={busy} />
        </label>
        <label>
          <span>Owner's email</span>
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                 placeholder="tutor@example.com" required disabled={busy} />
        </label>
      </div>
      <p className="pl-admin__formnote">
        {applicant
          ? `Provisioning for ${applicant.fullName}'s approved and paid application. `
          : ""}
        The workspace is created unowned. Ownership transfers when the invited
        tutor accepts — nothing else claims it in the meantime.
      </p>
      <div className="pl-admin__formactions">
        <button type="button" className="pl-admin__ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="pl-admin__btn" disabled={busy || !name.trim() || !ownerEmail.trim()}>
          {busy ? <><LoaderCircle size={15} className="pl-admin__spin" /> Working…</> : "Create and invite"}
        </button>
      </div>
    </form>
  );
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ── The one moment the raw token is visible ─────────────────────────────── */

function IssuedLink({ issued, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const absolute = `${window.location.origin}${issued.invitationLink}`;

  return (
    <div className={`pl-admin__issued ${issued.delivered ? "" : "is-undelivered"}`}>
      <div>
        <strong>
          {issued.delivered
            ? `Invitation emailed to ${issued.email}`
            : `Invitation ready for ${issued.email} — not delivered`}
        </strong>
        <p>
          {issued.delivered
            ? "The link is below as a fallback in case the email doesn't arrive. It's shown once — reopening this page won't show it again, and resending replaces it."
            : "Sending failed, so send this link yourself. The invitation itself is valid either way. It's shown once — reopening this page won't show it again."}
          {!issued.delivered && issued.deliveryDetail && (
            <><br /><span className="pl-admin__why">Reason: {issued.deliveryDetail}</span></>
          )}
        </p>
        <code>{absolute}</code>
      </div>
      <div className="pl-admin__issuedactions">
        <button
          className="pl-admin__btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(absolute);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);   // clipboard blocked; the link is on screen to copy by hand
            }
          }}
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
        </button>
        <button className="pl-admin__ghost" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return <div className="pl-admin"><style>{CSS}</style><div className="pl-admin__inner">{children}</div></div>;
}

const CSS = `
  .pl-admin {
    --ink: #E8EAED; --ink-soft: #949AA5; --line: #2A2F36;
    --surface: #1B1F24; --bg: #131619; --accent: #4C8DFF;
    --warn: #E0A83E; --ok: #4FBF8B;
    font-family: 'Karla', system-ui, sans-serif;
    background: var(--bg); color: var(--ink); min-height: 100vh; padding: 32px 26px 64px;
  }
  .pl-admin *, .pl-admin *::before, .pl-admin *::after { box-sizing: border-box; }
  .pl-admin__inner { max-width: 1080px; margin: 0 auto; }

  /* UIC-004: the page's own header (eyebrow + h1) is centered; its actions
     sit in their own row underneath rather than beside it. */
  .pl-admin__head { display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 24px; }
  .pl-admin__headtitle { text-align: center; }
  .pl-admin__eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .pl-admin h1 { font-family: 'Fraunces', Georgia, serif; font-size: 1.8rem; font-weight: 600; margin: 0; }
  .pl-admin__headactions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

  .pl-admin__btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: inherit; font-size: 0.85rem; font-weight: 600;
    background: var(--accent); color: #0B1220; border: none; border-radius: 8px;
    padding: 8px 14px; cursor: pointer;
  }
  .pl-admin__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pl-admin__ghost {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: inherit; font-size: 0.85rem;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; cursor: pointer;
  }
  .pl-admin__ghost:hover { color: var(--ink); border-color: #3C434C; }

  .pl-admin__alert {
    display: flex; align-items: center; gap: 9px;
    background: rgba(224,97,90,0.12); border: 1px solid rgba(224,97,90,0.4);
    color: #E0615A; border-radius: 10px; padding: 10px 13px; margin-bottom: 18px; font-size: 0.87rem;
  }

  .pl-admin__form { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  /* UIC-003: one property per row — label left, value right. */
  .pl-admin__formrow { display: grid; grid-template-columns: max-content 1fr; row-gap: 14px; column-gap: 16px; align-items: start; }
  .pl-admin__formrow > label { display: contents; }
  .pl-admin__form label > span:first-child { font-size: 0.8rem; font-weight: 600; padding-top: 9px; white-space: nowrap; }
  .pl-admin__form input {
    width: 100%; font-family: inherit; font-size: 0.9rem;
    background: #0F1215; color: var(--ink); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px;
  }
  .pl-admin__form input:focus-visible { outline: none; border-color: var(--accent); }
  .pl-admin__formnote { font-size: 0.8rem; color: var(--ink-soft); margin: 14px 0 0; line-height: 1.55; }
  .pl-admin__formactions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

  .pl-admin__issued {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: rgba(76,141,255,0.1); border: 1px solid rgba(76,141,255,0.4);
    border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;
  }
  .pl-admin__issued p { font-size: 0.83rem; color: var(--ink-soft); margin: 6px 0 10px; max-width: 62ch; line-height: 1.55; }
  .pl-admin__issued code {
    display: block; font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem;
    background: #0F1215; border: 1px solid var(--line); border-radius: 7px;
    padding: 9px 11px; word-break: break-all; color: var(--accent);
  }
  .pl-admin__issued.is-undelivered { background: rgba(224,168,62,0.1); border-color: rgba(224,168,62,0.45); }
  .pl-admin__issued.is-undelivered code { color: var(--warn); }
  .pl-admin__why { color: var(--warn); font-size: 0.8rem; }
  .pl-admin__issuedactions { display: flex; gap: 8px; flex-shrink: 0; }

  .pl-admin__apps { margin-bottom: 26px; }
  .pl-admin__h2 {
    font-family: 'IBM Plex Mono', monospace; font-size: 11px;
    letter-spacing: 0.08em; text-transform: uppercase; font-weight: 500;
    color: var(--ink-soft); margin: 0 0 10px;
  }
  .pl-admin__applist { display: flex; flex-direction: column; gap: 8px; }
  .pl-admin__app {
    display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: 11px; padding: 14px 16px;
  }
  .pl-admin__app.is-attention { border-color: rgba(224,168,62,0.4); background: rgba(224,168,62,0.05); }
  .pl-admin__appwho { flex: 1; min-width: 200px; }
  .pl-admin__appwho strong { display: block; font-size: 0.93rem; }
  .pl-admin__appwho span { display: block; font-size: 0.79rem; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__appwho p { font-size: 0.83rem; color: var(--ink-soft); margin: 8px 0 0; max-width: 60ch; line-height: 1.55; }
  .pl-admin__appstate { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; flex-shrink: 0; }

  .pl-admin__tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
  .pl-admin__table { width: 100%; border-collapse: collapse; font-size: 0.87rem; min-width: 860px; }
  .pl-admin__table th {
    text-align: start; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft);
    font-weight: 500; padding: 11px 14px; background: var(--surface); border-bottom: 1px solid var(--line);
  }
  .pl-admin__table td { padding: 13px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .pl-admin__table tr:last-child td { border-bottom: none; }
  .pl-admin__table tr.is-attention { background: rgba(224,168,62,0.06); }

  .pl-admin__wsname { display: block; font-weight: 600; }
  .pl-admin__slug { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__pill {
    display: inline-block; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px;
    background: #262B31; color: var(--ink-soft); border-radius: 20px; padding: 3px 9px;
  }
  .pl-admin__pill.is-warn { background: rgba(224,168,62,0.16); color: var(--warn); }
  .pl-admin__pill.is-ok { background: rgba(79,191,139,0.14); color: var(--ok); }
  .pl-admin__inv { display: block; font-size: 0.84rem; }
  .pl-admin__invmeta { display: block; font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--ink-soft); margin-top: 2px; }
  .pl-admin__muted { color: var(--ink-soft); }

  .pl-admin__actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .pl-admin__actions button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: inherit; font-size: 11.5px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .pl-admin__actions button:hover:not(:disabled) { color: var(--ink); border-color: #3C434C; }
  .pl-admin__actions button:disabled { opacity: 0.45; cursor: not-allowed; }

  .pl-admin__loading, .pl-admin__empty {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    flex-direction: column; color: var(--ink-soft); font-size: 0.9rem;
    padding: 50px 20px; border: 1px dashed var(--line); border-radius: 12px;
  }
  .pl-admin__loading { flex-direction: row; }

  .pl-admin__denied {
    max-width: 460px; margin: 60px auto; text-align: center; color: var(--ink-soft);
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 40px 30px;
  }
  .pl-admin__denied h1 { font-size: 1.3rem; color: var(--ink); margin: 14px 0 10px; }
  .pl-admin__denied p { font-size: 0.9rem; line-height: 1.6; margin: 0 0 20px; }

  .pl-admin__spin { animation: plAdminSpin 0.9s linear infinite; }
  @keyframes plAdminSpin { to { transform: rotate(360deg); } }

  @media (max-width: 560px) {
    .pl-admin__formrow { grid-template-columns: 1fr; }
    .pl-admin__formrow > label { display: flex; flex-direction: column; gap: 5px; }
    .pl-admin__form label > span:first-child { padding-top: 0; white-space: normal; }
  }
  @media (prefers-reduced-motion: reduce) { .pl-admin__spin { animation: none; } }
`;
