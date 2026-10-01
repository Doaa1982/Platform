import { useAuth } from "./auth/authContext";
import { EntryError, EntryLoading } from "./components/EntryShell";
import { useLanguage } from "./i18n/useLanguage";
import LoginScreen from "./screens/LoginScreen";
import WorkspacePicker from "./screens/WorkspacePicker";
import App from "./App.jsx";

/* =========================================================================
   AUTH GATE — which of the three states this side is in.

     anonymous              → sign in on this side
     authenticated, no ws   → choose a workspace on this side
     authenticated + ws     → the surface for this side

   The middle state is not a detour: roles are Workspace-scoped, so the app
   genuinely cannot know what to render until a Workspace is chosen.
   ========================================================================= */

export default function AuthGate({ side, navigate }) {
  const { status, workspace, signOut } = useAuth();
  const { t } = useLanguage();

  if (status === "loading") return <EntryLoading label={t("entry.restoringSession")} />;

  // The profile couldn't be loaded for a reason other than an expired session (the API is
  // down, a network failure) — the raw error is English developer text, so it isn't shown.
  if (status === "error") {
    return <EntryError title={t("entry.sessionErrorTitle")} lead={t("entry.sessionErrorBody")}
                       actionLabel={t("entry.backToSignIn")} onAction={signOut} />;
  }

  if (status === "anonymous") {
    return (
      <LoginScreen
        side={side}
        onBack={() => navigate("/")}
        onForgotPassword={() => navigate(`/forgot-password/${side}`)}
      />
    );
  }

  if (!workspace) {
    return <WorkspacePicker side={side} onSwitchSide={navigate} />;
  }

  // App reads session and side from context, so it needs no props
  return <App />;
}
