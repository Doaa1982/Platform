import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import { AuthContext } from "./authContext";

/* =========================================================================
   AUTH PROVIDER — holds the signed-in Identity and the Workspaces it reaches.

   Deliberately separates two things the domain also separates:
     session   — who this person is, globally (Identity Aggregate)
     workspace — which Workspace they are acting inside, and the roles held
                 *there* (Membership Aggregate)

   There is no global "role" anywhere in this file, because there is no such
   thing in the domain: a person may be a Teacher in one Workspace and a
   Learner in another.
   ========================================================================= */

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => api.loadSession());
  const [me, setMe] = useState(null);
  const [chosenSlug, setChosenSlug] = useState(null);
  const [status, setStatus] = useState(() => (api.loadSession() ? "loading" : "anonymous"));
  const [error, setError] = useState(null);

  /* Load the profile behind the current token. A token the API no longer
     accepts (expired, revoked, signing key rotated) must end the session
     rather than leave the app half-authenticated. State is only set from the
     async callbacks, never synchronously in the effect body. */
  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    api.getMe(session.token)
      .then((profile) => {
        if (cancelled) return;
        setMe(profile);
        setStatus("authenticated");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          api.clearSession();
          setSession(null);
          setMe(null);
          setStatus("anonymous");
        } else {
          setError(err.message);
          setStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [session]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const result = await api.login(email, password);
    const next = { token: result.token, expiresAt: result.expiresAt, fullName: result.fullName };
    api.saveSession(next);
    setStatus("loading");
    setSession(next);          // triggers the profile fetch above
    return next;
  }, []);

  const signOut = useCallback(() => {
    api.clearSession();
    setSession(null);
    setMe(null);
    setChosenSlug(null);
    setError(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(() => {
    const workspaces = me?.workspaces ?? [];

    // Only Active Memberships can be entered. Pending and Suspended are listed
    // so the picker can explain them, never selected.
    const active = workspaces.filter((w) => w.membershipStatus === "Active");

    /* Derived, not stored: with exactly one Active Membership there is no
       choice to make, so the picker is skipped. Deriving avoids a setState
       inside an effect and stays correct if the workspace list reloads. */
    const workspace =
      active.find((w) => w.slug === chosenSlug) ??
      (active.length === 1 ? active[0] : null);

    return {
      status,
      error,
      session,
      me,
      workspaces,
      workspace,
      /** Roles held in the CURRENT Workspace only — never global. */
      roles: workspace?.roles ?? [],
      hasRole: (role) => (workspace?.roles ?? []).includes(role),
      selectWorkspace: setChosenSlug,
      leaveWorkspace: () => setChosenSlug(null),
      signIn,
      signOut,
    };
  }, [status, error, session, me, chosenSlug, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
