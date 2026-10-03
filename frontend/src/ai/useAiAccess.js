import { useContext } from "react";
import { AiAccessContext, aiAccess } from "./aiAccessStore";

/** { state, refresh, navigate } for one CapabilityDomain. Outside an AiAccessProvider (the learner
 *  side, isolated tests) nothing is known, so nothing is locked: the backend still decides. */
export function useAiAccess(domain) {
  const ctx = useContext(AiAccessContext);
  if (!ctx) return { state: "unknown", refresh: () => {}, navigate: null };
  return { state: aiAccess(ctx.subscription, domain), refresh: ctx.refresh, navigate: ctx.navigate };
}
