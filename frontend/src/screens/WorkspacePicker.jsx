import { Building2, ArrowRight, ArrowLeftRight, LogOut, Clock, PauseCircle } from "lucide-react";
import { useAuth } from "../auth/authContext";
import { SIDES, rolesMatchSide } from "../auth/sides";
import { useLanguage } from "../i18n/useLanguage";
import EntryShell from "../components/EntryShell";
import { isolate, roleLabel } from "../i18n/format";

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
  const { me, workspaces, selectWorkspace, signOut } = useAuth();
  const { t } = useLanguage();
  const otherKey = side === "teach" ? "learn" : "teach";
  const other = SIDES[otherKey];

  const active = workspaces.filter((w) => w.membershipStatus === "Active");
  const mine = active.filter((w) => rolesMatchSide(w.roles, side));
  const otherSide = active.filter((w) => !rolesMatchSide(w.roles, side) && rolesMatchSide(w.roles, other.key));
  const blocked = workspaces.filter((w) => w.membershipStatus !== "Active");
  const sideLabel = t(`sides.${side}.label`);
  const otherLabel = t(`sides.${otherKey}.label`);
  const roles = (w) => w.roles.map((r) => roleLabel(t, r)).join(t("picker.roleSeparator"));

  return (
    <EntryShell>
      <section className="lw-card lw-entry__card lw-entry__card--start">
        <div className="lw-entry__row">
          <div>
            <p className="lw-entry__note lw-entry__note--top">{t("picker.signedInAs", { side: sideLabel, email: isolate(me?.email ?? "") })}</p>
            <h1 className="lw-entry__title">{t("picker.title")}</h1>
          </div>
          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={signOut}>
            <LogOut size={14} className="lw-flip" aria-hidden="true" /> {t("picker.signOut")}
          </button>
        </div>

        {mine.length > 0 && (
          <ul className="lw-wslist">
            {mine.map((w) => (
              <li key={w.workspaceId}>
                <button type="button" className="lw-wscard" onClick={() => selectWorkspace(w.slug)}>
                  <span className="lw-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                  <span className="lw-wscard__body">
                    <bdi className="lw-wscard__name">{w.name}</bdi>
                    <span className="lw-wscard__note">{roles(w)}</span>
                  </span>
                  <ArrowRight size={18} className="lw-flip lw-wscard__go" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {mine.length === 0 && (
          <div className="lw-entry__empty">
            <Building2 size={26} aria-hidden="true" />
            <h2>{otherSide.length > 0 ? t("picker.emptyOtherTitle", { side: sideLabel }) : t("picker.emptyNoneTitle")}</h2>
            <p>
              {otherSide.length > 0
                ? t(otherSide.length === 1 ? "picker.emptyOtherBodyOne" : "picker.emptyOtherBodyMany", { count: otherSide.length, side: otherLabel })
                : t("picker.emptyNoneBody")}
            </p>
            {otherSide.length > 0 && (
              <button type="button" className="lw-btn lw-btn--accent" onClick={() => onSwitchSide(other.path)}>
                <ArrowLeftRight size={15} aria-hidden="true" /> {t("picker.switchTo", { side: otherLabel })}
              </button>
            )}
          </div>
        )}

        {mine.length > 0 && otherSide.length > 0 && (
          <>
            <h2 className="lw-wslist__head">{t("picker.onOtherSide", { side: otherLabel })}</h2>
            <ul className="lw-wslist">
              {otherSide.map((w) => (
                <li key={w.workspaceId}>
                  <button type="button" className="lw-wscard is-other" onClick={() => onSwitchSide(other.path)}>
                    <span className="lw-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                    <span className="lw-wscard__body">
                      <bdi className="lw-wscard__name">{w.name}</bdi>
                      <span className="lw-wscard__note">
                        <ArrowLeftRight size={13} aria-hidden="true" /> {t("picker.otherSideNote", { roles: roles(w), side: otherLabel })}
                      </span>
                    </span>
                    <ArrowRight size={18} className="lw-flip lw-wscard__go" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {blocked.length > 0 && (
          <>
            <h2 className="lw-wslist__head">{t("picker.notAvailable")}</h2>
            <ul className="lw-wslist">
              {blocked.map((w) => {
                const state = BLOCKED[w.membershipStatus] ?? BLOCKED.Pending;
                const Icon = state.icon;
                return (
                  <li key={w.workspaceId}>
                    <div className="lw-wscard is-blocked">
                      <span className="lw-wscard__mark" aria-hidden="true">{w.name.trim()[0]}</span>
                      <span className="lw-wscard__body">
                        <bdi className="lw-wscard__name">{w.name}</bdi>
                        <span className="lw-wscard__note"><Icon size={13} aria-hidden="true" /> {t(state.noteKey)}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </EntryShell>
  );
}
