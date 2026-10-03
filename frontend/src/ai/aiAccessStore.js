import { createContext } from "react";
import { aiLevelForProfile } from "../i18n/subscriptionLabels";

/* =========================================================================
   Whether an AI action is available to this workspace, and if not, why —
   so an AI button can say so before it's clicked instead of failing with a
   toast in the corner (2026-10-03).

   Read from GET /workspaces/{slug}/subscription, the same data the backend
   resolves entitlements from. The rules mirror EntitlementResolutionService:
     · CreditFundedAiDomains — Learning and Branding AI are on for every plan
       while the workspace has credits (product decision 2026-10-03);
     · any other domain follows the plan: its profile must be above Foundation;
     · no credits, or a License that isn't Active/Grace, turns all AI off.
   The backend still enforces all of this; this only decides what a button
   shows. Domain names are the backend's CapabilityDomain values.
   ========================================================================= */

export const CREDIT_FUNDED_AI_DOMAINS = ["Learning", "Branding"];

/** "allowed" | "plan" (not in this plan) | "credits" (none left) | "inactive" (subscription paused) | "unknown" */
export function aiAccess(subscription, domain) {
  if (subscription === undefined) return "unknown";       // still loading, or couldn't be read: don't block
  if (subscription === null) return "plan";                // no subscription at all grants no AI
  if (!["Active", "Grace"].includes(subscription.licenseStatus)) return "inactive";
  const profile = subscription.entitlements?.find((e) => e.key === `profile:${domain}`)?.value;
  const planAllows = CREDIT_FUNDED_AI_DOMAINS.includes(domain) || (profile && aiLevelForProfile(profile) !== "Manual");
  if (!planAllows) return "plan";
  if ((subscription.aiCreditsRemaining ?? 0) <= 0) return "credits";
  return "allowed";
}

/** What an AI call's failure means for the teacher — the same kinds aiAccess() returns, plus "failed". */
export function aiErrorKind(error) {
  if (error?.creditsExhausted) return "credits";
  if (error?.status === 403) return "plan";
  return "failed";
}

/** Where each kind sends the teacher to fix it (owner screens in App.jsx's OWNER_NAV). */
export const AI_FIX_SCREEN = { plan: "plans", credits: "aiCredits", inactive: "billing" };

export const AiAccessContext = createContext(null);
