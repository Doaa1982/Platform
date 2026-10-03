import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import { AiAccessContext } from "./aiAccessStore";

/**
 * Loads the workspace's subscription once and shares it with every AI button below. Re-read
 * whenever `refreshKey` changes (App passes the current owner screen, so coming back from Plans
 * or AI Credits sees the new plan or balance) and whenever a button's call is refused.
 * A 404 means no subscription, so no AI; any other failure leaves the state unknown (nothing
 * locked) — e.g. a teacher who may not read billing.
 */
export default function AiAccessProvider({ token, slug, refreshKey, navigate, children }) {
  const [subscription, setSubscription] = useState(undefined);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    api.getSubscription(token, slug)
      .then((s) => { if (!cancelled) setSubscription(s ?? null); })
      .catch((e) => { if (!cancelled) setSubscription(e?.status === 404 ? null : undefined); });
    return () => { cancelled = true; };
  }, [token, slug, refreshKey, nonce]);

  const value = useMemo(() => ({ subscription, refresh, navigate }), [subscription, refresh, navigate]);
  return <AiAccessContext.Provider value={value}>{children}</AiAccessContext.Provider>;
}
