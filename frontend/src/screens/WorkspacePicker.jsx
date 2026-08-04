import { Building2, ArrowRight, LogOut, Clock, PauseCircle } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { useFonts } from "../hooks/useFonts";

/* =========================================================================
   WORKSPACE PICKER

   The bridge between "who you are" and "where you are working". A person may
   hold different roles in each Workspace, so this is the moment the app
   learns which role set applies — nothing before this point can know it.

   Skipped automatically when exactly one Active Membership exists.
   ========================================================================= */

/** Non-Active Memberships are listed but not enterable, with the reason shown. */
const BLOCKED = {
  Pending:   { icon: Clock,        note: "Invitation not accepted yet" },
  Suspended: { icon: PauseCircle,  note: "Access suspended" },
  Archived:  { icon: PauseCircle,  note: "Archived" },
};

export default function WorkspacePicker() {
  useFonts();
  const { me, workspaces, selectWorkspace, signOut } = useAuth();

  const active = workspaces.filter((w) => w.membershipStatus === "Active");
  const blocked = workspaces.filter((w) => w.membershipStatus !== "Active");

  return (
    <div className="pl-picker">
      <style>{CSS}</style>

      <header className="pl-picker__head">
        <div>
          <div className="pl-picker__eyebrow">Signed in as {me?.email}</div>
          <h1 className="pl-picker__title">Choose a workspace</h1>
        </div>
        <button className="pl-picker__signout" onClick={signOut}>
          <LogOut size={15} aria-hidden="true" /> Sign out
        </button>
      </header>

      {workspaces.length === 0 && (
        <div className="pl-picker__empty">
          <Building2 size={28} aria-hidden="true" />
          <h2>You don't belong to any workspace yet</h2>
          <p>
            Workspaces are joined by invitation. Once someone invites you — or you
            create your own — it will appear here.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <ul className="pl-picker__list">
          {active.map((w) => (
            <li key={w.workspaceId}>
              <button className="pl-wscard" onClick={() => selectWorkspace(w.slug)}>
                <span className="pl-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                <span className="pl-wscard__body">
                  <span className="pl-wscard__name">{w.name}</span>
                  <span className="pl-wscard__roles">
                    {w.roles.length > 0
                      ? w.roles.map((r) => (
                          <span className="pl-role" key={r}>{humanise(r)}</span>
                        ))
                      : <span className="pl-wscard__norole">Member, no roles assigned</span>}
                  </span>
                </span>
                <ArrowRight size={18} className="pl-wscard__go" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {blocked.length > 0 && (
        <>
          <h2 className="pl-picker__subhead">Not available</h2>
          <ul className="pl-picker__list">
            {blocked.map((w) => {
              const state = BLOCKED[w.membershipStatus] ?? { icon: PauseCircle, note: w.membershipStatus };
              const Icon = state.icon;
              return (
                <li key={w.workspaceId}>
                  <div className="pl-wscard is-blocked">
                    <span className="pl-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                    <span className="pl-wscard__body">
                      <span className="pl-wscard__name">{w.name}</span>
                      <span className="pl-wscard__blockednote">
                        <Icon size={13} aria-hidden="true" /> {state.note}
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** AssistantTeacher → "Assistant Teacher" */
function humanise(role) {
  return role.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const CSS = `
  .pl-picker {
    --pl-bg: #F7F5F1;
    --pl-surface: #FFFFFF;
    --pl-ink: #1B2430;
    --pl-ink-soft: #6A7383;
    --pl-accent: #2D5BD1;
    --pl-line: #E1DED7;

    font-family: 'Karla', system-ui, sans-serif;
    color: var(--pl-ink);
    background: var(--pl-bg);
    min-height: 100vh;
    padding: 56px 28px 72px;
  }
  .pl-picker *, .pl-picker *::before, .pl-picker *::after { box-sizing: border-box; }

  .pl-picker__head {
    max-width: 620px; margin: 0 auto 28px;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  }
  .pl-picker__eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px; letter-spacing: 0.06em;
    color: var(--pl-ink-soft); margin-bottom: 8px;
    overflow-wrap: anywhere;
  }
  .pl-picker__title {
    font-family: 'Fraunces', Georgia, serif;
    font-size: 1.9rem; font-weight: 600; margin: 0; line-height: 1.1;
  }
  .pl-picker__signout {
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    font-family: inherit; font-size: 0.84rem;
    color: var(--pl-ink-soft); background: transparent;
    border: 1px solid var(--pl-line); border-radius: 8px;
    padding: 7px 12px; cursor: pointer;
  }
  .pl-picker__signout:hover { color: var(--pl-ink); border-color: #C9C5BC; }
  .pl-picker__signout:focus-visible { outline: 2px solid var(--pl-accent); outline-offset: 1px; }

  .pl-picker__subhead {
    max-width: 620px; margin: 30px auto 12px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 500; color: var(--pl-ink-soft);
  }

  .pl-picker__list { max-width: 620px; margin: 0 auto; padding: 0; list-style: none; display: grid; gap: 10px; }

  .pl-wscard {
    width: 100%;
    display: flex; align-items: center; gap: 14px; text-align: left;
    background: var(--pl-surface);
    border: 1px solid var(--pl-line);
    border-radius: 12px;
    padding: 15px 16px;
    font-family: inherit; color: inherit;
    cursor: pointer;
    transition: border-color .15s, box-shadow .15s, transform .15s;
  }
  button.pl-wscard:hover {
    border-color: var(--pl-accent);
    box-shadow: 0 2px 14px rgba(27,36,48,0.07);
    transform: translateY(-1px);
  }
  button.pl-wscard:focus-visible { outline: 2px solid var(--pl-accent); outline-offset: 2px; }
  .pl-wscard.is-blocked { cursor: default; opacity: 0.62; background: transparent; }

  .pl-wscard__mark {
    flex-shrink: 0;
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--pl-accent); color: #fff;
    font-family: 'Fraunces', Georgia, serif; font-size: 1.15rem; font-weight: 600;
  }
  .pl-wscard.is-blocked .pl-wscard__mark { background: #B9BCC3; }

  .pl-wscard__body { flex: 1; min-width: 0; }
  .pl-wscard__name { display: block; font-weight: 600; font-size: 0.98rem; margin-bottom: 5px; }
  .pl-wscard__roles { display: flex; flex-wrap: wrap; gap: 5px; }
  .pl-wscard__norole { font-size: 0.8rem; color: var(--pl-ink-soft); font-style: italic; }
  .pl-wscard__go { color: var(--pl-ink-soft); flex-shrink: 0; }
  .pl-wscard__blockednote {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.8rem; color: var(--pl-ink-soft);
  }

  .pl-role {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px; letter-spacing: 0.03em;
    background: #EDF1FB; color: #2449AC;
    border-radius: 20px; padding: 3px 9px;
  }

  .pl-picker__empty {
    max-width: 620px; margin: 0 auto;
    background: var(--pl-surface); border: 1px dashed var(--pl-line);
    border-radius: 14px; padding: 40px 28px; text-align: center;
    color: var(--pl-ink-soft);
  }
  .pl-picker__empty h2 {
    font-family: 'Fraunces', Georgia, serif; font-size: 1.15rem;
    color: var(--pl-ink); margin: 14px 0 8px; font-weight: 600;
  }
  .pl-picker__empty p { font-size: 0.9rem; line-height: 1.6; max-width: 44ch; margin: 0 auto; }

  @media (max-width: 520px) {
    .pl-picker { padding: 36px 20px 56px; }
    .pl-picker__head { flex-direction: column; align-items: flex-start; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pl-wscard { transition: none; }
    button.pl-wscard:hover { transform: none; }
  }
`;
