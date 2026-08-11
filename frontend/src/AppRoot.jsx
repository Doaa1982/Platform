import { AuthProvider } from "./auth/AuthProvider";
import { sideFromPath, SIDE_KEYS } from "./auth/sides";
import { useRoute } from "./hooks/useRoute";
import InviteScreen from "./screens/InviteScreen";
import JoinScreen from "./screens/JoinScreen";
import RootGate from "./RootGate";
import ApplyScreen from "./screens/ApplyScreen";
import SignupStatusScreen from "./screens/SignupStatusScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import AuthGate from "./AuthGate";
import AdminGate from "./AdminGate";

/* =========================================================================
   APP ROOT — routing sits above the auth provider.

     /                platform landing, or routed onward if signed in
     /apply           become a tutor
     /apply/status/…  an applicant checking their own application
     /teach           teaching side
     /learn           learning side
     /admin           platform operations (deliberately unlinked anywhere)
     /invite/{token}  accepting an invitation
     /join/{slug}     asking to join a workspace
     /forgot-password/{side}   requesting a password reset link
     /reset-password/{token}   redeeming one

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
          onSignIn={() => navigate("/learn")}
        />
      </AuthProvider>
    );
  }

  // Requesting a link needs no session; opening a reset link is the same
  // Invitation-style pattern (a token stands in for authentication). The
  // `side` segment carries no authority — see ForgotPasswordScreen's remarks.
  const forgotSide = match(pathname, /^\/forgot-password\/([^/]+)\/?$/);
  if (forgotSide) {
    const side = SIDE_KEYS.includes(forgotSide) ? forgotSide : "teach";
    return (
      <AuthProvider side={null}>
        <ForgotPasswordScreen side={side} onBack={() => navigate(`/${side}`)} />
      </AuthProvider>
    );
  }

  const resetToken = match(pathname, /^\/reset-password\/([^/]+)\/?$/);
  if (resetToken) {
    return (
      <AuthProvider side={null}>
        <ResetPasswordScreen token={resetToken} onDone={() => navigate("/", { replace: true })} />
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

  // The Signup Status Link. Anonymous by necessity: an applicant has no
  // Identity at this stage, so the token is their only way back (BA-008).
  const statusToken = match(pathname, /^\/apply\/status\/([^/]+)\/?$/);
  if (statusToken) {
    return (
      <AuthProvider side={null}>
        <SignupStatusScreen token={statusToken} onApplyAgain={() => navigate("/apply")} />
      </AuthProvider>
    );
  }

  if (path === "/apply") {
    return (
      <AuthProvider side={null}>
        <ApplyScreen
          onBack={() => navigate("/")}
          onSignIn={() => navigate("/teach")}
          onStatus={(link) => navigate(link)}
        />
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
