import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle, AlertCircle, UserPlus, Copy, Check, Crown,
  PauseCircle, PlayCircle, UserX, UserCheck, Plus, X, RefreshCw,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";

/* =========================================================================
   MEMBERS SCREEN — the tutor's own member management.

   Replaces the prototype's simulated version with the real Membership
   lifecycle. Everything here is Workspace-scoped: the roles shown, the roles
   assignable, and the caller's own right to change any of it, all resolved
   server-side from the caller's Membership on every request.

   The owner's row is deliberately different. INV-006 protects the Membership
   currently designated Workspace Owner from suspension, archival and removal
   until ownership has been transferred, so those actions are absent rather
   than present-and-failing.
   ========================================================================= */

/** Roles a workspace manager may grant. Owner is absent on purpose — ownership
    transfers, it is not assigned (BA-006). */
const GRANTABLE = ["Administrator", "Teacher", "AssistantTeacher", "Learner", "Parent", "FinanceManager"];

export default function MembersScreen() {
  const { session, workspace } = useAuth();
  const slug = workspace?.slug;

  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(
    () => Promise.all([
      api.getMembers(session.token, slug),
      // A member who cannot review simply has no queue — not an error
      api.getJoinRequests(session.token, slug).catch(() => []),
    ]).then(([members, joins]) => { setData(members); setRequests(joins); setError(null); })
      .catch((e) => setError(e.message)),
    [session.token, slug]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getMembers(session.token, slug),
      api.getJoinRequests(session.token, slug).catch(() => []),
    ]).then(([members, joins]) => {
      if (cancelled) return;
      setData(members); setRequests(joins); setError(null);
    }).catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

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

  if (error && !data) {
    return (
      <div className="lw-page">
        <div className="lw-members__alert"><AlertCircle size={16} /> {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="lw-page">
        <div className="lw-members__loading"><LoaderCircle size={18} className="lw-members__spin" /> Loading members…</div>
      </div>
    );
  }

  const openInvites = data.invitations.filter((i) => i.isOpen);
  const pendingRequests = requests.filter((r) => r.status === "Submitted");

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">Workspace Access Context</div>
      <h1>Members</h1>
      <p className="lw-sub">
        Who belongs to {data.workspaceName}, and what they may do here. Roles are
        scoped to this workspace — they confer nothing anywhere else.
      </p>

      {error && <div className="lw-members__alert"><AlertCircle size={16} /> {error}</div>}

      {data.canManage && (
        <div className="lw-members__bar">
          <button className="lw-btn lw-btn--accent lw-btn--sm" onClick={() => setInviteOpen((v) => !v)}>
            <UserPlus size={14} /> Invite someone
          </button>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={load} disabled={busy}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      )}

      {inviteOpen && data.canManage && (
        <InviteForm
          busy={busy}
          onCancel={() => setInviteOpen(false)}
          onSubmit={async (body) => {
            const res = await run(() => api.inviteMember(session.token, slug, body));
            if (res) { setIssued(res); setInviteOpen(false); }
          }}
        />
      )}

      {issued && <IssuedInvite issued={issued} onDismiss={() => setIssued(null)} />}

      <div className="lw-members__list">
        {data.members.map((m) => (
          <div className="lw-members__row" key={m.membershipId}>
            <div className="lw-members__avatar">{m.fullName.trim()[0]}</div>

            <div className="lw-members__who">
              <div className="lw-members__name">
                {m.fullName}
                {m.isOwner && <span className="lw-members__owner"><Crown size={11} /> Owner</span>}
              </div>
              <div className="lw-members__email">{m.email}</div>
              <div className="lw-members__roles">
                {m.roles.map((r) => (
                  <span className="lw-members__role" key={r}>
                    {humanise(r)}
                    {data.canManage && r !== "Owner" && (
                      <button
                        aria-label={`Remove ${humanise(r)}`}
                        disabled={busy}
                        onClick={() => run(() => api.removeMemberRole(session.token, slug, m.membershipId, r))}
                      ><X size={10} /></button>
                    )}
                  </span>
                ))}
                {data.canManage && (
                  <RoleAdder
                    busy={busy}
                    existing={m.roles}
                    onAdd={(role) => run(() => api.assignMemberRole(session.token, slug, m.membershipId, role))}
                  />
                )}
              </div>
            </div>

            <span className={`lw-members__status is-${m.status.toLowerCase()}`}>{m.status}</span>

            {data.canManage && (
              <div className="lw-members__actions">
                {m.status === "Pending" && (
                  <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "activate"))}>
                    <PlayCircle size={12} /> Activate
                  </button>
                )}
                {/* INV-006: the owner's row offers none of these until ownership moves */}
                {!m.isOwner && m.status === "Active" && (
                  <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "suspend"))}>
                    <PauseCircle size={12} /> Suspend
                  </button>
                )}
                {!m.isOwner && m.status === "Suspended" && (
                  <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "reinstate"))}>
                    <PlayCircle size={12} /> Reinstate
                  </button>
                )}
                {!m.isOwner && m.status === "Active" && (
                  <button disabled={busy} onClick={() => run(() => api.memberAction(session.token, slug, m.membershipId, "remove"))}>
                    <UserX size={12} /> Remove
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* People who asked to get in, rather than being asked. Placed above
          invitations because these are the ones waiting on a decision. */}
      {pendingRequests.length > 0 && (
        <>
          <h2 className="lw-sectiontitle">Requests to join</h2>
          <div className="lw-members__list">
            {pendingRequests.map((r) => (
              <div className="lw-members__row" key={r.id}>
                <div className="lw-members__avatar is-request">{r.fullName.trim()[0]}</div>
                <div className="lw-members__who">
                  <div className="lw-members__name">{r.fullName}</div>
                  <div className="lw-members__email">
                    {r.email} · asked to join as {humanise(r.requestedRole)}
                  </div>
                  {r.message && <div className="lw-members__msg">“{r.message}”</div>}
                </div>
                <span className="lw-members__status is-pending">{r.status}</span>
                {data.canManage && (
                  <div className="lw-members__actions">
                    <button disabled={busy}
                            onClick={() => run(() => api.decideJoinRequest(session.token, slug, r.id, "approve"))}>
                      <UserCheck size={12} /> Approve
                    </button>
                    <button disabled={busy}
                            onClick={() => run(() => api.decideJoinRequest(session.token, slug, r.id, "decline"))}>
                      <X size={12} /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {openInvites.length > 0 && (
        <>
          <h2 className="lw-sectiontitle">Pending invitations</h2>
          <div className="lw-members__list">
            {openInvites.map((i) => (
              <div className="lw-members__row" key={i.id}>
                <div className="lw-members__avatar is-pending">?</div>
                <div className="lw-members__who">
                  <div className="lw-members__name">{i.email}</div>
                  <div className="lw-members__email">
                    Invited as {humanise(i.intendedRole)} · expires{" "}
                    {new Date(i.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="lw-members__status is-pending">{i.status}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {!data.canManage && (
        <p className="lw-members__readonly">
          You're viewing this list. Only an owner or administrator can invite or
          change members here.
        </p>
      )}
    </div>
  );
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

function RoleAdder({ existing, onAdd, busy }) {
  const [open, setOpen] = useState(false);
  const available = GRANTABLE.filter((r) => !existing.includes(r));
  if (available.length === 0) return null;

  return open ? (
    <select
      className="lw-members__rolepick"
      autoFocus
      disabled={busy}
      defaultValue=""
      onChange={(e) => { if (e.target.value) { onAdd(e.target.value); setOpen(false); } }}
      onBlur={() => setOpen(false)}
    >
      <option value="" disabled>Add role…</option>
      {available.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
    </select>
  ) : (
    <button className="lw-members__roleadd" onClick={() => setOpen(true)} disabled={busy}>
      <Plus size={10} /> Role
    </button>
  );
}

function InviteForm({ onSubmit, onCancel, busy }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Learner");

  return (
    <form
      className="lw-members__form"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ email: email.trim(), role }); }}
    >
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="their@email.com" required autoFocus disabled={busy}
      />
      <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
        {GRANTABLE.map((r) => <option key={r} value={r}>{humanise(r)}</option>)}
      </select>
      <button type="submit" className="lw-btn lw-btn--accent lw-btn--sm" disabled={busy || !email.trim()}>
        {busy ? <LoaderCircle size={14} className="lw-members__spin" /> : "Send invitation"}
      </button>
      <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onCancel} disabled={busy}>Cancel</button>
    </form>
  );
}

function IssuedInvite({ issued, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const absolute = `${window.location.origin}${issued.invitationLink}`;

  return (
    <div className={`lw-members__issued ${issued.delivered ? "" : "is-undelivered"}`}>
      <div>
        <strong>
          {issued.delivered
            ? `Invitation emailed to ${issued.email}`
            : `Invitation ready for ${issued.email} — not delivered`}
        </strong>
        <p>
          {issued.delivered
            ? "The link is here too, in case the email doesn't arrive. It's shown once."
            : `Sending failed${issued.deliveryDetail ? ` (${issued.deliveryDetail})` : ""}, so send this link yourself. The invitation is valid either way.`}
        </p>
        <code>{absolute}</code>
      </div>
      <div className="lw-members__issuedactions">
        <button
          className="lw-btn lw-btn--accent lw-btn--sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(absolute);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch { setCopied(false); }
          }}
        >
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  );
}

function humanise(role) {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const CSS = `
  .lw-members__bar { display: flex; gap: 8px; margin-bottom: 18px; }
  .lw-members__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }

  .lw-members__alert {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    color: var(--danger); border-radius: var(--radius-sm);
    padding: 10px 13px; margin-bottom: 16px; font-size: 0.87rem;
  }

  .lw-members__form {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 14px; margin-bottom: 16px;
  }
  .lw-members__form input, .lw-members__form select {
    font-family: var(--font-body); font-size: 0.88rem; color: var(--ink);
    background: var(--bg); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 8px 10px;
  }
  .lw-members__form input { flex: 1; min-width: 200px; }

  .lw-members__issued {
    display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 18px;
  }
  .lw-members__issued.is-undelivered {
    background: color-mix(in srgb, var(--danger) 8%, transparent);
    border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  }
  .lw-members__issued p { font-size: 0.82rem; color: var(--ink-soft); margin: 5px 0 9px; max-width: 60ch; }
  .lw-members__issued code {
    display: block; font-family: var(--font-mono); font-size: 0.75rem;
    background: var(--bg); border: 1px solid var(--line);
    border-radius: 6px; padding: 8px 10px; word-break: break-all;
  }
  .lw-members__issuedactions { display: flex; gap: 6px; align-items: flex-start; }

  .lw-members__list { display: flex; flex-direction: column; gap: 8px; }
  .lw-members__row {
    display: flex; align-items: center; gap: 13px;
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius-sm); padding: 13px 15px;
  }
  .lw-members__avatar {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
    font-family: var(--font-display); font-weight: 600;
  }
  .lw-members__avatar.is-pending { background: var(--line); color: var(--ink-soft); }
  .lw-members__avatar.is-request { background: var(--accent-2); }
  .lw-members__msg {
    font-size: 0.82rem; color: var(--ink-soft); font-style: italic;
    margin-top: 6px; max-width: 52ch; line-height: 1.5;
  }

  .lw-members__who { flex: 1; min-width: 0; }
  .lw-members__name { font-weight: 600; font-size: 0.93rem; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .lw-members__owner {
    display: inline-flex; align-items: center; gap: 3px;
    font-family: var(--font-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em;
    background: var(--accent-2); color: #fff; border-radius: 20px; padding: 2px 7px;
  }
  .lw-members__email { font-size: 0.79rem; color: var(--ink-soft); margin-top: 2px; }
  .lw-members__roles { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 7px; }
  .lw-members__role {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-mono); font-size: 10px;
    background: var(--surface-2); color: var(--ink); border-radius: 20px; padding: 3px 8px;
  }
  .lw-members__role button {
    display: flex; background: transparent; border: none; padding: 0;
    color: var(--ink-soft); cursor: pointer; line-height: 0;
  }
  .lw-members__role button:hover { color: var(--danger); }
  .lw-members__roleadd {
    display: inline-flex; align-items: center; gap: 3px;
    font-family: var(--font-mono); font-size: 10px;
    background: transparent; color: var(--ink-soft);
    border: 1px dashed var(--line); border-radius: 20px; padding: 3px 8px; cursor: pointer;
  }
  .lw-members__rolepick {
    font-family: var(--font-body); font-size: 11px;
    background: var(--bg); color: var(--ink);
    border: 1px solid var(--accent); border-radius: 20px; padding: 3px 6px;
  }

  .lw-members__status {
    font-family: var(--font-mono); font-size: 10px; flex-shrink: 0;
    border-radius: 20px; padding: 3px 9px;
    background: var(--surface-2); color: var(--ink-soft);
  }
  .lw-members__status.is-active { background: color-mix(in srgb, var(--accent-2) 18%, transparent); color: var(--accent-2); }
  .lw-members__status.is-suspended, .lw-members__status.is-pending { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }

  .lw-members__actions { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
  .lw-members__actions button {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--font-body); font-size: 11px;
    background: transparent; color: var(--ink-soft);
    border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; cursor: pointer;
  }
  .lw-members__actions button:hover:not(:disabled) { color: var(--ink); }
  .lw-members__actions button:disabled { opacity: 0.45; cursor: not-allowed; }

  .lw-members__readonly { font-size: 0.83rem; color: var(--ink-soft); margin-top: 18px; font-style: italic; }

  .lw-members__spin { animation: lwMemSpin 0.9s linear infinite; }
  @keyframes lwMemSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-members__spin { animation: none; } }
`;
