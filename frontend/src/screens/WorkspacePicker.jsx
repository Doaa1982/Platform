import { Building2, ArrowRight, ArrowLeftRight, LogOut, Clock, PauseCircle } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { SIDES, rolesMatchSide } from "../auth/sides";
import { useFonts } from "../hooks/useFonts";
import { useLanguage } from "../i18n/useLanguage";
import LanguageToggle, { LANGUAGE_TOGGLE_CSS } from "../i18n/LanguageToggle";

/* =========================================================================
   WORKSPACE PICKER — the bridge between "who you are" and "where you work".

   Filtered by the side you came in through, because roles are Workspace-scoped:
   a Workspace where you are only a Learner has nothing to offer the teaching
   surface, and vice versa. Rather than hide those, they are listed under the
   other side with a one-click switch — the honest answer to "why isn't my
   academy here?".

   Skipped automatically when exactly one Workspace qualifies for this side.
   ========================================================================= */

/** Non-Active Memberships are listed but not enterable, with the reason shown. */
const BLOCKED = {
  Pending:   { icon: Clock,       noteKey: "picker.blockedPending" },
  Suspended: { icon: PauseCircle, noteKey: "picker.blockedSuspended" },
  Archived:  { icon: PauseCircle, noteKey: "picker.blockedArchived" },
};

export default function WorkspacePicker({ side, onSwitchSide }) {
  useFonts();
  const { me, workspaces, selectWorkspace, signOut } = useAuth();
  const { t } = useLanguage();
  const otherKey = side === "teach" ? "learn" : "teach";

  const config = SIDES[side];
  const other = SIDES[otherKey];

  const active = workspaces.filter((w) => w.membershipStatus === "Active");
  const mine = active.filter((w) => rolesMatchSide(w.roles, side));
  const otherSide = active.filter((w) => !rolesMatchSide(w.roles, side) && rolesMatchSide(w.roles, other.key));
  const blocked = workspaces.filter((w) => w.membershipStatus !== "Active");
  const sideLabel = t(`sides.${side}.label`);
  const otherLabel = t(`sides.${otherKey}.label`);

  return (
    <div className="pl-picker" style={{ "--accent": config.login.accent }}>
      <style>{CSS}</style>
      <div className="pl-picker__langtoggle"><LanguageToggle /></div>

      <header className="pl-picker__head">
        <div>
          <div className="pl-picker__eyebrow">
            {t("picker.signedInAs", { side: sideLabel, email: me?.email })}
          </div>
          <h1 className="pl-picker__title">{t("picker.title")}</h1>
        </div>
        <button className="pl-picker__signout" onClick={signOut}>
          <LogOut size={15} aria-hidden="true" /> {t("picker.signOut")}
        </button>
      </header>

      {mine.length > 0 && (
        <ul className="pl-picker__list">
          {mine.map((w) => (
            <li key={w.workspaceId}>
              <button className="pl-wscard" onClick={() => selectWorkspace(w.slug)}>
                <span className="pl-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                <span className="pl-wscard__body">
                  <span className="pl-wscard__name">{w.name}</span>
                  <span className="pl-wscard__roles">
                    {w.roles.map((r) => (
                      <span className="pl-role" key={r}>{humanise(r)}</span>
                    ))}
                  </span>
                </span>
                <ArrowRight size={18} className="pl-wscard__go" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {mine.length === 0 && (
        <div className="pl-picker__empty">
          <Building2 size={28} aria-hidden="true" />
          <h2>
            {otherSide.length > 0
              ? t("picker.emptyOtherTitle", { side: sideLabel })
              : t("picker.emptyNoneTitle")}
          </h2>
          <p>
            {otherSide.length > 0
              ? t("picker.emptyOtherBody", { count: plural(otherSide.length, "workspace"), side: otherLabel })
              : t("picker.emptyNoneBody")}
          </p>
          {otherSide.length > 0 && (
            <button className="pl-picker__switch" onClick={() => onSwitchSide(other.path)}>
              <ArrowLeftRight size={15} aria-hidden="true" /> {t("picker.switchTo", { side: otherLabel })}
            </button>
          )}
        </div>
      )}

      {mine.length > 0 && otherSide.length > 0 && (
        <>
          <h2 className="pl-picker__subhead">{t("picker.onOtherSide", { side: otherLabel })}</h2>
          <ul className="pl-picker__list">
            {otherSide.map((w) => (
              <li key={w.workspaceId}>
                <button className="pl-wscard is-other" onClick={() => onSwitchSide(other.path)}>
                  <span className="pl-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                  <span className="pl-wscard__body">
                    <span className="pl-wscard__name">{w.name}</span>
                    <span className="pl-wscard__blockednote">
                      <ArrowLeftRight size={13} aria-hidden="true" />
                      {t("picker.otherSideNote", { roles: w.roles.map(humanise).join(", "), side: otherLabel })}
                    </span>
                  </span>
                  <ArrowRight size={18} className="pl-wscard__go" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {blocked.length > 0 && (
        <>
          <h2 className="pl-picker__subhead">{t("picker.notAvailable")}</h2>
          <ul className="pl-picker__list">
            {blocked.map((w) => {
              const state = BLOCKED[w.membershipStatus];
              const Icon = state?.icon ?? PauseCircle;
              const note = state ? t(state.noteKey) : w.membershipStatus;
              return (
                <li key={w.workspaceId}>
                  <div className="pl-wscard is-blocked">
                    <span className="pl-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                    <span className="pl-wscard__body">
                      <span className="pl-wscard__name">{w.name}</span>
                      <span className="pl-wscard__blockednote">
                        <Icon size={13} aria-hidden="true" /> {note}
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

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const CSS = `
  .pl-picker {
    --pl-surface: #FFFFFF;
    --pl-ink: #1B2430;
    --pl-ink-soft: #6A7383;
    --pl-line: #E1DED7;

    font-family: 'Karla', system-ui, sans-serif;
    color: var(--pl-ink);
    background: #F7F5F1;
    min-height: 100vh; position: relative;
    padding: 56px 28px 72px;
  }
  .pl-picker *, .pl-picker *::before, .pl-picker *::after { box-sizing: border-box; }
  .pl-picker__langtoggle { position: absolute; top: 20px; inset-inline-end: 20px; }

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
  .pl-picker__signout:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  .pl-picker__subhead {
    max-width: 620px; margin: 30px auto 12px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 500; color: var(--pl-ink-soft);
  }

  .pl-picker__list { max-width: 620px; margin: 0 auto; padding: 0; list-style: none; display: grid; gap: 10px; }

  .pl-wscard {
    width: 100%;
    display: flex; align-items: center; gap: 14px; text-align: start;
    background: var(--pl-surface);
    border: 1px solid var(--pl-line);
    border-radius: 12px;
    padding: 15px 16px;
    font-family: inherit; color: inherit;
    cursor: pointer;
    transition: border-color .15s, box-shadow .15s, transform .15s;
  }
  button.pl-wscard:hover {
    border-color: var(--accent);
    box-shadow: 0 2px 14px rgba(27,36,48,0.07);
    transform: translateY(-1px);
  }
  button.pl-wscard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .pl-wscard.is-blocked { cursor: default; opacity: 0.62; background: transparent; }
  .pl-wscard.is-other { background: transparent; }

  .pl-wscard__mark {
    flex-shrink: 0;
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent); color: #fff;
    font-family: 'Fraunces', Georgia, serif; font-size: 1.15rem; font-weight: 600;
  }
  .pl-wscard.is-blocked .pl-wscard__mark { background: #B9BCC3; }
  .pl-wscard.is-other .pl-wscard__mark { background: #9AA1AC; }

  .pl-wscard__body { flex: 1; min-width: 0; }
  .pl-wscard__name { display: block; font-weight: 600; font-size: 0.98rem; margin-bottom: 5px; }
  .pl-wscard__roles { display: flex; flex-wrap: wrap; gap: 5px; }
  .pl-wscard__go { color: var(--pl-ink-soft); flex-shrink: 0; }
  .pl-wscard__blockednote {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.8rem; color: var(--pl-ink-soft);
  }

  .pl-role {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10.5px; letter-spacing: 0.03em;
    background: color-mix(in srgb, var(--accent) 12%, #fff);
    color: color-mix(in srgb, var(--accent) 78%, #000);
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
  .pl-picker__empty p { font-size: 0.9rem; line-height: 1.6; max-width: 46ch; margin: 0 auto; }
  .pl-picker__switch {
    display: inline-flex; align-items: center; gap: 7px; margin-top: 20px;
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: #fff; background: var(--accent);
    border: none; border-radius: 9px; padding: 10px 16px; cursor: pointer;
  }
  .pl-picker__switch:focus-visible { outline: 2px solid var(--pl-ink); outline-offset: 2px; }

  @media (max-width: 520px) {
    .pl-picker { padding: 36px 20px 56px; }
    .pl-picker__head { flex-direction: column; align-items: flex-start; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pl-wscard { transition: none; }
    button.pl-wscard:hover { transform: none; }
  }

  ${LANGUAGE_TOGGLE_CSS}
`;
