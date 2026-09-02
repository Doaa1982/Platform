import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import { AuthContext } from "./authContext";
import { rolesMatchSide } from "./sides";

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

export function AuthProvider({ side, children }) {
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

  /**
   * Takes on a session obtained somewhere other than the sign-in form —
   * accepting an invitation, or submitting a join request, both of which return
   * one because the person has just been created.
   *
   * Those screens must go through here rather than writing storage directly.
   * The provider reads storage once, at mount, and navigating between routes
   * does not remount it: every branch of AppRoot renders an AuthProvider in the
   * same position, so React preserves its state. A session written behind its
   * back is therefore invisible — and if someone was already signed in (an
   * admin who had just copied the invitation link, say), the app would carry on
   * as that person and show their workspaces instead of the new account's.
   */
  const adoptSession = useCallback((next) => {
    api.saveSession(next);
    setError(null);
    setMe(null);              // the previous person's profile must not linger
    setChosenSlug(null);      // nor their workspace choice
    setStatus("loading");
    setSession(next);         // triggers the profile fetch above
  }, []);

  /**
   * Re-reads the profile from the API.
   *
   * The workspace name, slug and roles in this provider are a snapshot taken at
   * sign-in. Anything that changes them elsewhere — renaming a workspace in
   * setup, a role being granted — leaves the chrome showing stale values until
   * the next sign-in, which reads as the app disagreeing with what you just did.
   *
   * Deliberately silent: it does not touch `status`, so a refresh never flashes
   * the app back to a loading screen. A failure leaves the previous profile in
   * place, which is the better of two imperfect outcomes.
   */
  const refreshProfile = useCallback(async () => {
    if (!session) return;
    try {
      setMe(await api.getMe(session.token));
    } catch {
      // Keep what we have; the next deliberate action will surface any real problem
    }
  }, [session]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const result = await api.login(email, password);
    const next = { token: result.token, expiresAt: result.expiresAt, fullName: result.fullName };
    adoptSession(next);
    return next;
  }, [adoptSession]);

  const signOut = useCallback(() => {
    // Best-effort, fire-and-forget: ends every session server-side (Identity.
    // TokenVersion), but must never delay or block the local sign-out below —
    // a network hiccup here is not a reason to leave someone stuck signed in.
    if (session) api.logout(session.token).catch(() => {});
    api.clearSession();
    setSession(null);
    setMe(null);
    setChosenSlug(null);
    setError(null);
    setStatus("anonymous");
  }, [session]);

  const value = useMemo(() => {
    const workspaces = me?.workspaces ?? [];

    // Only Active Memberships can be entered. Pending and Suspended are listed
    // so the picker can explain them, never selected.
    const active = workspaces.filter((w) => w.membershipStatus === "Active");

    /* Only Workspaces whose roles belong to the current side are enterable
       here. This is what stops the teaching surface from opening in a
       Workspace where the person is merely a Learner — the door they used
       never grants anything; these roles do. */
    const eligible = active.filter((w) => rolesMatchSide(w.roles, side));

    /* Derived, not stored: with exactly one eligible Workspace there is no
       choice to make, so the picker is skipped. Deriving avoids a setState
       inside an effect and stays correct when the side or the list changes. */
    const workspace =
      eligible.find((w) => w.slug === chosenSlug) ??
      (eligible.length === 1 ? eligible[0] : null);

    return {
      status,
      error,
      session,
      me,
      side,
      workspaces,
      /** Workspaces enterable from the current side. */
      eligibleWorkspaces: eligible,
      workspace,
      /** Roles held in the CURRENT Workspace only — never global. */
      roles: workspace?.roles ?? [],
      hasRole: (role) => (workspace?.roles ?? []).includes(role),
      selectWorkspace: setChosenSlug,
      leaveWorkspace: () => setChosenSlug(null),
      adoptSession,
      refreshProfile,
      signIn,
      signOut,
    };
  }, [status, error, session, me, side, chosenSlug, adoptSession, refreshProfile, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
