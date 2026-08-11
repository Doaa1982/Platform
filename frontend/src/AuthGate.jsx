import { LoaderCircle, AlertCircle } from "lucide-react";
import { useAuth } from "./auth/authContext";
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
  const { status, error, workspace, signOut } = useAuth();

  if (status === "loading") {
    return (
      <Splash>
        <LoaderCircle size={22} className="pl-splash__spin" aria-hidden="true" />
        <p>Restoring your session…</p>
      </Splash>
    );
  }

  if (status === "error") {
    return (
      <Splash>
        <AlertCircle size={22} aria-hidden="true" />
        <p>{error}</p>
        <button className="pl-splash__btn" onClick={signOut}>Back to sign in</button>
      </Splash>
    );
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

function Splash({ children }) {
  return (
    <div className="pl-splash" role="status">
      <style>{CSS}</style>
      {children}
    </div>
  );
}

const CSS = `
  .pl-splash {
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
    background: #F7F5F1; color: #6A7383;
    font-family: 'Karla', system-ui, sans-serif; font-size: 0.92rem;
    padding: 24px; text-align: center;
  }
  .pl-splash p { margin: 0; max-width: 40ch; }
  .pl-splash__spin { animation: plSplashSpin 0.9s linear infinite; }
  @keyframes plSplashSpin { to { transform: rotate(360deg); } }
  .pl-splash__btn {
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    color: #fff; background: #2D5BD1;
    border: none; border-radius: 9px; padding: 9px 18px; cursor: pointer;
  }
  .pl-splash__btn:focus-visible { outline: 2px solid #1B2430; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .pl-splash__spin { animation: none; } }
`;
