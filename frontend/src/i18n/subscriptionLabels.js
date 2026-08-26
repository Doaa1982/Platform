/** Shared plan/entitlement label helpers — used by SubscriptionScreen (Billing)
 * and WorkspaceHomeScreen (the plans comparison shown on the portal home),
 * so the two stay in lock-step rather than drifting into two label sets. */

export const LEVEL_KEY = { Foundation: "subscription.levelFoundation", Professional: "subscription.levelProfessional", AiPlus: "subscription.levelAiPlus" };
export const levelLabel = (t, v) => t(LEVEL_KEY[v] ?? "") || v;

export const AI_KEY = { Manual: "subscription.aiManual", Assist: "subscription.aiAssist", CoPilot: "subscription.aiCoPilot" };
export const aiLabel = (t, v) => t(AI_KEY[v] ?? "") || v;

export const DOMAIN_KEY = { Learning: "subscription.domainLearning", Assessment: "subscription.domainAssessment", Analytics: "subscription.domainAnalytics", Branding: "subscription.domainBranding" };
export const domainLabel = (t, v) => t(DOMAIN_KEY[v] ?? "") || v;

export const LEVEL_ORDER = { Foundation: 0, Professional: 1, AiPlus: 2 };
export const ENTITLEMENT_DOMAINS = ["Learning", "Assessment", "Analytics", "Branding"];

/** Mirrors the backend's CommercialCatalog.FreePlanCode — the one plan whose
 * capacity Base/Max is an enforced hard cap. Every paid plan has no ceiling:
 * Base is just what's included, and a tutor can keep buying capacity add-ons
 * past it with no upper bound (ConfigurationService only checks the Max
 * ceiling when the plan code matches this constant). */
export const FREE_PLAN_CODE = "solo-free";

/** Capacity display text for one plan-card row. On the Free plan, Base/Max is
 * a real ceiling, so a wider Max is shown as a range ("15–265"). On every
 * paid plan the Max column is inert (kept equal to Base by the catalog seed),
 * so only Base is shown — appending `unit` (e.g. "GB") when given. */
export function capacityValue(plan, base, max, unit = "") {
  const suffix = unit ? ` ${unit}` : "";
  return plan.code === FREE_PLAN_CODE && max > base ? `${base}–${max}${suffix}` : `${base}${suffix}`;
}

/** Whether this plan-card row should carry the "no cap" hint — true for every paid plan. */
export const capacityUncapped = (plan) => plan.code !== FREE_PLAN_CODE;

/** learningProfile / assessmentProfile / analyticsProfile / brandingProfile — the plan's own field naming. */
export function planProfileForDomain(plan, domain) {
  return plan[`${domain.charAt(0).toLowerCase()}${domain.slice(1)}Profile`];
}

/** Mirrors backend EntitlementResolutionService.AiLevelFor — a fixed, domain-independent
 * mapping, so a plan's per-domain AI Assistance level can be read straight off its
 * profile level without calling the live entitlements endpoint. (The one runtime
 * wrinkle, Restricted/Expired licenses forcing Manual, doesn't apply to a catalog plan.) */
export const PROFILE_TO_AI_LEVEL = { Foundation: "Manual", Professional: "Assist", AiPlus: "CoPilot" };
export const aiLevelForProfile = (profile) => PROFILE_TO_AI_LEVEL[profile];

/** "Assessment >= Professional" → { domain: "Assessment", level: "Professional" } */
export function parseRequirement(raw) {
  if (!raw) return null;
  const [domain, level] = raw.split(">=").map((s) => s.trim());
  return domain && level ? { domain, level } : null;
}

/** { Learning: "AiPlus" } → [{ domain: "Learning", level: "AiPlus" }], in the same
 * canonical Learning/Assessment/Analytics/Branding order as ENTITLEMENT_DOMAINS —
 * not object key order, which just mirrors however the backend happened to serialize it. */
export function packGrants(pack) {
  return Object.entries(pack.domainGrants ?? {})
    .map(([domain, level]) => ({ domain, level }))
    .sort((a, b) => ENTITLEMENT_DOMAINS.indexOf(a.domain) - ENTITLEMENT_DOMAINS.indexOf(b.domain));
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "");
