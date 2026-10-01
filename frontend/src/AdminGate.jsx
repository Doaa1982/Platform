import { useAuth } from "./auth/authContext";
import { EntryError, EntryLoading } from "./components/EntryShell";
import { useLanguage } from "./i18n/useLanguage";
import AdminLogin from "./screens/AdminLogin";
import AdminScreen from "./screens/AdminScreen";

/* =========================================================================
   ADMIN GATE.

   Only two states, unlike the teach/learn sides: there is no workspace to
   choose, because platform administration is not Workspace-scoped.

   Being signed in is NOT the same as being an administrator. This gate only
   establishes a session; whether that session holds a PlatformOperator grant
   is decided by the server on the first admin call, and AdminScreen renders
   the refusal honestly rather than hiding itself.
   ========================================================================= */

export default function AdminGate({ navigate }) {
  const { status, signOut } = useAuth();
  const { t } = useLanguage();

  if (status === "loading") return <EntryLoading label={t("entry.restoringSession")} />;

  // The profile couldn't be loaded for a reason other than an expired session (the API is
  // down, a network failure) — the raw error is English developer text, so it isn't shown.
  if (status === "error") {
    return <EntryError title={t("entry.sessionErrorTitle")} lead={t("entry.sessionErrorBody")}
                       actionLabel={t("entry.backToSignIn")} onAction={signOut} />;
  }

  if (status === "anonymous") return <AdminLogin onBack={() => navigate("/")} />;

  return <AdminScreen />;
}
