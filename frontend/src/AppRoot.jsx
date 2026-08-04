import { AuthProvider } from "./auth/AuthProvider";
import { sideFromPath } from "./auth/sides";
import { useRoute } from "./hooks/useRoute";
import SideChooser from "./screens/SideChooser";
import InviteScreen from "./screens/InviteScreen";
import AuthGate from "./AuthGate";
import AdminGate from "./AdminGate";

/* =========================================================================
   APP ROOT — routing sits above the auth provider.

     /                which door?
     /teach           teaching side
     /learn           learning side
     /admin           platform operations (not a "side" — see below)
     /invite/{token}  accepting an invitation

   /admin is deliberately NOT one of the SIDES. A side is a grouping of
   Workspace roles; platform administration is not Workspace-scoped at all,
   and its authority comes from a PlatformOperator grant. Treating it as a
   third side would have implied a role that does not exist.

   Routing is above AuthProvider so the provider can take the side as a prop
   and filter Workspaces by it. Because every branch renders the provider in
   the same position, moving between them re-renders rather than remounts it —
   so the session survives, and nobody signs in twice.
   ========================================================================= */

export default function AppRoot() {
  const { pathname, navigate } = useRoute();

  // Invitation links must work for someone with no account at all, so this
  // route resolves before any authentication decision.
  const inviteToken = matchInvite(pathname);
  if (inviteToken) {
    return (
      <AuthProvider side={null}>
        <InviteScreen token={inviteToken} onAccepted={() => navigate("/teach", { replace: true })} />
      </AuthProvider>
    );
  }

  if (pathname.replace(/\/+$/, "") === "/admin") {
    return (
      <AuthProvider side={null}>
        <AdminGate navigate={navigate} />
      </AuthProvider>
    );
  }

  const side = sideFromPath(pathname);
  if (!side) return <SideChooser onChoose={navigate} />;

  return (
    <AuthProvider side={side}>
      <AuthGate side={side} navigate={navigate} />
    </AuthProvider>
  );
}

/** "/invite/abc123" → "abc123" */
function matchInvite(pathname) {
  const match = pathname.match(/^\/invite\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}
