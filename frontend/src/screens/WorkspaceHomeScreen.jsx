import { useEffect, useState } from "react";
import {
  LoaderCircle, ArrowRight, Check, Circle,
  Users, UserPlus, Inbox, Rocket, Globe, Lock,
} from "lucide-react";
import * as api from "../api/client";
import { useAuth } from "../auth/authContext";
import { useLanguage } from "../i18n/useLanguage";
import Message from "../components/Message";
import PlanPickerCards, { PLAN_PICKER_CARDS_CSS } from "../components/PlanPickerCards";
import CurrentPlanCard, { CURRENT_PLAN_CARD_CSS } from "../components/CurrentPlanCard";

/* =========================================================================
   WORKSPACE HOME — what an owner sees on arrival.

   Replaces the prototype's Overview, which reported revenue, enrolments and
   learner counts drawn from fixture data. For a workspace minutes old that was
   not an empty state, it was a false statement about someone's business — and
   the first thing they'd have seen after accepting their invitation.

   Everything here is measured, not imagined. Where a domain does not exist yet
   (products, enrolments, revenue) this says so rather than showing a zero that
   implies the feature is working and the number is real.

   The first-run case is the default rather than a special mode: a workspace
   arrives Created and unconfigured, so "not set up yet" is simply what is true
   at that moment, and the page stops leading with it once it stops applying.
   ========================================================================= */

export default function WorkspaceHomeScreen({ onNavigate }) {
  const { session, workspace, me } = useAuth();
  const { t } = useLanguage();
  const slug = workspace?.slug;

  const [setup, setSetup] = useState(null);
  const [members, setMembers] = useState(null);
  const [requests, setRequests] = useState([]);
  const [plans, setPlans] = useState(null);
  const [packs, setPacks] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getSetup(session.token, slug),
      api.getMembers(session.token, slug),
      // Only owners and admins can read this; anyone else simply has no queue
      api.getJoinRequests(session.token, slug).catch(() => []),
      api.getCommercialPlans().catch(() => []),
      api.getCommercialPacks().catch(() => []),
      // 404 just means no subscription exists yet — a normal state, not an error
      api.getSubscription(session.token, slug).catch(() => null),
    ])
      .then(([s, m, j, p, k, sub]) => {
        if (cancelled) return;
        setSetup(s); setMembers(m); setRequests(j); setPlans(p); setPacks(k); setSubscription(sub); setError(null);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session.token, slug]);

  if (error) {
    return <div className="lw-page"><Message type="error">{error}</Message></div>;
  }
  if (!setup || !members) {
    return (
      <div className="lw-page">
        <div className="lw-home__loading"><LoaderCircle size={18} className="lw-home__spin" /> {t("home.loading")}</div>
      </div>
    );
  }

  const isLive = setup.status === "Active";
  // Mirrors SubscriptionScreen's isLive: a Cancelled subscription still has
  // access until cancellationEffectiveDate (SUB-004) — licenseStatus is
  // Licensing's own authoritative answer, not re-derived here.
  const subscriptionLive = subscription && subscription.licenseStatus !== "Expired";
  const activeMembers = members.members.filter((m) => m.status === "Active");
  const learners = activeMembers.filter((m) => m.roles.includes("Learner"));
  const teachers = activeMembers.filter((m) =>
    m.roles.some((r) => ["Teacher", "AssistantTeacher", "Owner", "Administrator"].includes(r)));
  const pendingInvites = members.invitations.filter((i) => i.isOpen);
  const pendingRequests = requests.filter((r) => r.status === "Submitted");

  // Nobody but the owner yet, and not published — this is genuinely day one
  const isFirstRun = !isLive && activeMembers.length <= 1 && pendingInvites.length === 0;

  const firstName = (me?.fullName ?? "").trim().split(" ")[0];

  return (
    <div className="lw-page">
      <style>{CSS}</style>

      <div className="lw-eyebrow">{setup.name}</div>
      <h1>{isFirstRun ? (firstName ? t("home.welcomeNamed", { name: firstName }) : t("home.welcome")) : t("home.overview")}</h1>
      <p className="lw-sub">
        {isFirstRun ? t("home.firstRunSub") : t("home.standsToday", { name: setup.name })}
      </p>

      {/* ── The one thing that matters until it's done ────────────────── */}
      {!isLive && (
        <div className="lw-home__setup">
          <div className="lw-home__setuptext">
            <strong>
              {setup.status === "Created" ? t("home.notSetUpTitle")
                : setup.status === "Published" ? t("home.almostThereTitle")
                : t("home.setupInProgressTitle")}
            </strong>
            <p>
              {t("home.currentlyPrefix")} <em>{setup.status}</em>. {t("home.currentlySuffix")}
            </p>
          </div>
          <button className="lw-btn lw-btn--accent" onClick={() => onNavigate("setup")}>
            {t("home.continueSetup")} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {isLive && (
        <div className="lw-home__live">
          <Rocket size={16} /> {t("home.liveBanner", { name: setup.name })}
        </div>
      )}

      {/* ── Measured facts only ──────────────────────────────────────── */}
      <div className="lw-home__stats">
        <Stat icon={Users} color={CARD_COLORS.teaching} label={t("home.statTeaching")} value={teachers.length}
              note={teachers.length === 1 ? t("home.statTeachingNoteSolo") : t("home.statTeachingNote")} />
        <Stat icon={Users} color={CARD_COLORS.learners} label={t("home.statLearners")} value={learners.length}
              note={learners.length === 0 ? t("home.statLearnersNoteNone") : t("home.statLearnersNote")} />
        <Stat icon={UserPlus} color={CARD_COLORS.invites} label={t("home.statInvites")} value={pendingInvites.length}
              note={pendingInvites.length === 0 ? t("home.statInvitesNoteNone") : t("home.statInvitesNote")} />
        <Stat icon={Inbox} color={CARD_COLORS.requests} label={t("home.statRequests")} value={pendingRequests.length}
              note={pendingRequests.length > 0 ? t("home.statRequestsWaiting") : setup.acceptsJoinRequests ? t("home.statRequestsNone") : t("home.statRequestsNotAccepting")}
              urgent={pendingRequests.length > 0} />
      </div>

      {/* ── This Workspace's subscription plans, Shopify-style ───────────
          A comparison grid right on the home page, not buried three clicks
          deep in Billing — the current plan (if any) is marked in place. */}
      {plans && plans.length > 0 && (
        <PlansSection plans={plans} packs={packs} subscription={subscription} live={subscriptionLive} onNavigate={onNavigate} />
      )}

      {/* ── What to do next, in the order it makes sense ─────────────────
          Only while there's a "next" left to do — once the workspace is
          live this would just be three permanently-checked lines, the same
          "nothing left to say" case that already hides the setup banner
          above. */}
      {!isLive && (
        <>
          <h2 className="lw-sectiontitle">{t("home.gettingStarted")}</h2>
          <ol className="lw-home__steps">
            <Step done label={t("home.stepAcceptInvite")} />
            <Step done={isLive}
                  label={t("home.stepPublish")}
                  action={!isLive ? { text: t("home.setUp"), to: "setup" } : null}
                  onNavigate={onNavigate} />
            <Step done={activeMembers.length > 1 || pendingInvites.length > 0}
                  label={t("home.stepInvite")}
                  action={{ text: t("home.invite"), to: "members" }}
                  onNavigate={onNavigate} />
          </ol>
        </>
      )}

      {/* ── Honest about what does not exist ─────────────────────────── */}
      <div className="lw-home__notyet">
        <strong>{t("home.notBuiltTitle")}</strong>
        <p>{t("home.notBuiltBody")}</p>
      </div>

      <p className="lw-home__addr">
        {isLive || setup.status === "Published"
          ? <><Globe size={13} /> {t("home.reachableAt")} <code>/{setup.slug}</code></>
          : <><Lock size={13} /> {t("home.notReachable")}</>}
      </p>
    </div>
  );
}

/* bg is derived (color-mix against --surface-2, see Stat) so these tints
   stay a light accent wash in Light mode and a muted dark-surface wash in
   Dark mode, instead of a hardcoded pastel fighting the page. */
const CARD_COLORS = {
  teaching: { icon: "#3E6FE0" },
  learners: { icon: "#1FA971" },
  invites: { icon: "#E0912E" },
  requests: { icon: "#E0537B" },
};

function Stat({ icon: Icon, color, label, value, note, urgent }) {
  const style = {
    "--card-bg": `color-mix(in srgb, ${color.icon} 16%, var(--surface-2))`,
    "--card-icon": color.icon,
  };
  return (
    <div className={`lw-home__stat ${urgent ? "is-urgent" : ""}`} style={style}>
      <div className="lw-home__staticon"><Icon size={17} /></div>
      <div className="lw-home__statlabel">{label}</div>
      <div className="lw-home__statvalue">{value}</div>
      <div className="lw-home__statnote">{note}</div>
    </div>
  );
}

function PlansSection({ plans, packs, subscription, live, onNavigate }) {
  const { t } = useLanguage();

  if (live) {
    const plan = plans.find((p) => p.code === subscription.planCode);
    return (
      <div className="lw-home__planssection">
        <div className="lw-home__planshead">
          <div>
            <h2 className="lw-sectiontitle">{t("home.plansSectionTitle")}</h2>
            <p className="lw-home__planslead">{t("home.plansSectionLeadActive")}</p>
          </div>
        </div>

        <CurrentPlanCard plan={plan} packs={packs} subscription={subscription}>
          <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => onNavigate("billing")}>
            {t("home.managePlan")} <ArrowRight size={13} />
          </button>
        </CurrentPlanCard>
      </div>
    );
  }

  return (
    <PlanPickerCards
      plans={plans} packs={packs}
      title={t("home.plansSectionTitle")} lead={t("home.plansSectionLead")}
      onChoosePlan={() => onNavigate("billing")}
    />
  );
}

function Step({ done, label, action, onNavigate }) {
  return (
    <li className={done ? "is-done" : ""}>
      <span className="lw-home__tick">{done ? <Check size={11} /> : <Circle size={7} />}</span>
      <span className="lw-home__steplabel">{label}</span>
      {!done && action && (
        <button className="lw-btn lw-btn--ghost lw-btn--sm" onClick={() => onNavigate(action.to)}>
          {action.text}
        </button>
      )}
    </li>
  );
}

const CSS = `
  .lw-home__loading { display: flex; align-items: center; gap: 9px; color: var(--ink-soft); padding: 30px 0; }

  .lw-home__setup {
    display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap;
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-sm); padding: 16px 18px; margin-bottom: 20px;
  }
  .lw-home__setuptext strong { font-size: 0.95rem; }
  .lw-home__setuptext p { font-size: 0.84rem; color: var(--ink-soft); margin: 4px 0 0; }
  .lw-home__setuptext em { font-style: normal; font-family: var(--font-mono); font-size: 0.8rem; }

  .lw-home__live {
    display: flex; align-items: center; gap: 9px;
    background: color-mix(in srgb, var(--accent-2) 12%, transparent);
    color: var(--accent-2); font-weight: 600; font-size: 0.9rem;
    border-radius: var(--radius-sm); padding: 13px 16px; margin-bottom: 20px;
  }

  .lw-home__planssection { margin-bottom: 26px; }
  .lw-home__planshead {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    flex-wrap: wrap; margin-bottom: 14px;
  }
  .lw-home__planshead .lw-sectiontitle { margin: 0; }
  .lw-home__planslead { font-size: 0.85rem; color: var(--ink-soft); margin: 4px 0 0; max-width: 60ch; }

  .lw-home__stats {
    display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 8px;
  }
  .lw-home__stat {
    background: var(--card-bg, var(--surface-2)); border: 1px solid transparent;
    border-radius: 16px; padding: 16px 18px; width: 160px; flex: 1 1 160px; max-width: 220px;
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .lw-home__stat.is-urgent { border-color: var(--card-icon); }
  .lw-home__staticon {
    width: 34px; height: 34px; border-radius: 9px; margin-bottom: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--card-icon, var(--ink-soft)); color: #fff;
  }
  .lw-home__statlabel {
    font-family: var(--font-display); font-size: 0.98rem; font-weight: 700;
    line-height: 1.25; margin-bottom: 6px;
  }
  .lw-home__statvalue { font-size: 1.3rem; font-weight: 700; color: var(--card-icon, var(--ink-soft)); margin-bottom: 2px; }
  .lw-home__statnote { font-size: 0.76rem; color: var(--ink-soft); }

  .lw-home__steps { list-style: none; padding: 0; margin: 0; }
  .lw-home__steps li {
    display: flex; align-items: center; gap: 11px;
    padding: 11px 0; border-bottom: 1px solid var(--line);
  }
  .lw-home__steps li:last-child { border-bottom: none; }
  .lw-home__tick {
    width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink-soft);
  }
  .lw-home__steps li.is-done .lw-home__tick { background: var(--accent-2); border-color: var(--accent-2); color: #fff; }
  .lw-home__steplabel { flex: 1; font-size: 0.9rem; }
  .lw-home__steps li.is-done .lw-home__steplabel { color: var(--ink-soft); text-decoration: line-through; }

  .lw-home__notyet {
    background: var(--surface-2); border-radius: var(--radius-sm);
    padding: 15px 17px; margin-top: 26px;
  }
  .lw-home__notyet strong {
    display: block; font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink-soft); margin-bottom: 7px;
  }
  .lw-home__notyet p { font-size: 0.85rem; color: var(--ink-soft); margin: 0; line-height: 1.6; max-width: 66ch; }

  .lw-home__addr {
    display: flex; align-items: center; gap: 7px;
    font-size: 0.8rem; color: var(--ink-soft); margin-top: 16px;
  }
  .lw-home__addr code { font-family: var(--font-mono); }

  .lw-home__spin { animation: lwHomeSpin 0.9s linear infinite; }
  @keyframes lwHomeSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .lw-home__spin { animation: none; } }

  ${PLAN_PICKER_CARDS_CSS}
  ${CURRENT_PLAN_CARD_CSS}
`;
