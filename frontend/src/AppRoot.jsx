import { AuthProvider } from "./auth/AuthProvider";
import { sideFromPath } from "./auth/sides";
import { useRoute } from "./hooks/useRoute";
import InviteScreen from "./screens/InviteScreen";
import JoinScreen from "./screens/JoinScreen";
import RootGate from "./RootGate";
import ApplyScreen from "./screens/ApplyScreen";
import AuthGate from "./AuthGate";
import AdminGate from "./AdminGate";

/* =========================================================================
   APP ROOT — routing sits above the auth provider.

     /                platform landing, or routed onward if signed in
     /apply           become a tutor
     /teach           teaching side
     /learn           learning side
     /admin           platform operations (deliberately unlinked anywhere)
     /invite/{token}  accepting an invitation
     /join/{slug}     asking to join a workspace

   There is deliberately no route that lists workspaces. Discovery happens
   entirely off-platform, permanently (Join Request BA-007, ADR-EA-002): a
   directory would put the platform in competition with its own paying
   customers for their students' attention.

   Routing is above AuthProvider so the provider can take the side as a prop
   and filter Workspaces by it. Every branch renders the provider in the same
   position, so moving between them re-renders rather than remounts it — the
   session survives, and nobody signs in twice.
   ========================================================================= */

export default function AppRoot() {
  const { pathname, navigate } = useRoute();

  // These two must work for someone with no account at all, so they resolve
  // before any authentication decision.
  const inviteToken = match(pathname, /^\/invite\/([^/]+)\/?$/);
  if (inviteToken) {
    return (
      <AuthProvider side={null}>
        <InviteScreen token={inviteToken} onAccepted={() => navigate("/teach", { replace: true })} />
      </AuthProvider>
    );
  }

  const joinSlug = match(pathname, /^\/join\/([^/]+)\/?$/);
  if (joinSlug) {
    return (
      <AuthProvider side={null}>
        <JoinScreen
          slug={joinSlug}
          onJoined={() => navigate("/learn", { replace: true })}
          onSignIn={() => navigate("/learn")}
        />
      </AuthProvider>
    );
  }

  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/admin") {
    return (
      <AuthProvider side={null}>
        <AdminGate navigate={navigate} />
      </AuthProvider>
    );
  }

  if (path === "/apply") {
    return (
      <AuthProvider side={null}>
        <ApplyScreen onBack={() => navigate("/")} onSignIn={() => navigate("/teach")} />
      </AuthProvider>
    );
  }

  const side = sideFromPath(pathname);
  if (!side) {
    // The root decides for itself whether the visitor is already known
    return (
      <AuthProvider side={null}>
        <RootGate navigate={navigate} />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider side={side}>
      <AuthGate side={side} navigate={navigate} />
    </AuthProvider>
  );
}

function match(pathname, pattern) {
  const found = pathname.match(pattern);
  return found ? decodeURIComponent(found[1]) : null;
}
