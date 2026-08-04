import { LoaderCircle, AlertCircle } from "lucide-react";
import { useAuth } from "./auth/authContext";
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
  const { status, error, signOut } = useAuth();

  if (status === "loading") {
    return (
      <Splash>
        <LoaderCircle size={22} className="pl-asplash__spin" aria-hidden="true" />
        <p>Restoring your session…</p>
      </Splash>
    );
  }

  if (status === "error") {
    return (
      <Splash>
        <AlertCircle size={22} aria-hidden="true" />
        <p>{error}</p>
        <button className="pl-asplash__btn" onClick={signOut}>Back to sign in</button>
      </Splash>
    );
  }

  if (status === "anonymous") return <AdminLogin onBack={() => navigate("/")} />;

  return <AdminScreen />;
}

function Splash({ children }) {
  return (
    <div className="pl-asplash" role="status">
      <style>{CSS}</style>
      {children}
    </div>
  );
}

const CSS = `
  .pl-asplash {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
    background: #131619; color: #949AA5;
    font-family: 'Karla', system-ui, sans-serif; font-size: 0.92rem;
    padding: 24px; text-align: center;
  }
  .pl-asplash p { margin: 0; max-width: 40ch; }
  .pl-asplash__spin { animation: plASpin 0.9s linear infinite; }
  @keyframes plASpin { to { transform: rotate(360deg); } }
  .pl-asplash__btn {
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: #0B1220; background: #4C8DFF; border: none;
    border-radius: 9px; padding: 9px 18px; cursor: pointer;
  }
  @media (prefers-reduced-motion: reduce) { .pl-asplash__spin { animation: none; } }
`;
