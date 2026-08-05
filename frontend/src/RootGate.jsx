import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "./auth/authContext";
import { sidesForRoles } from "./auth/sides";
import LandingScreen from "./screens/LandingScreen";

/* =========================================================================
   ROOT GATE — who is standing at "/".

   ADR-EA-002: "An authenticated visitor holding one or more Memberships is
   never shown the un-authenticated content; they are routed via the existing
   GET /api/me shape, not a new endpoint."

     · exactly one Active Membership → straight into that Workspace
     · more than one                 → the existing Workspace picker, reused
     · none, or not signed in        → the landing page's single call to action

   The third case matters: someone with an account but no Membership — a
   pending Join Request, or a declined one — is a real visitor, and they see
   the same pitch a stranger does rather than an error.
   ========================================================================= */

export default function RootGate({ navigate }) {
  const { status, workspaces } = useAuth();

  const active = workspaces.filter((w) => w.membershipStatus === "Active");

  /* Routed in an effect rather than during render: navigation is a side
     effect on window.history, and doing it mid-render would fight React.
     Depends on `workspaces` rather than the filtered list, which would be a
     fresh array every render and re-run this continuously. */
  useEffect(() => {
    if (status !== "authenticated") return;
    const active = workspaces.filter((w) => w.membershipStatus === "Active");
    if (active.length === 0) return;

    // One Membership: no choice to present, so present none. Land them on the
    // side their roles actually support rather than guessing.
    if (active.length === 1) {
      const [side] = sidesForRoles(active[0].roles);
      navigate(side ? `/${side}` : "/learn", { replace: true });
      return;
    }

    // Several: the picker already exists on each side and is reused, not
    // rebuilt. Teaching is the better default — a multi-workspace account is
    // far more likely to be a tutor than a learner.
    const teaches = active.some((w) => sidesForRoles(w.roles).includes("teach"));
    navigate(teaches ? "/teach" : "/learn", { replace: true });
  }, [status, workspaces, navigate]);

  if (status === "loading" || (status === "authenticated" && active.length > 0)) {
    return (
      <div className="pl-rootgate" role="status">
        <style>{CSS}</style>
        <LoaderCircle size={22} className="pl-rootgate__spin" aria-hidden="true" />
        <p>Taking you to your workspace…</p>
      </div>
    );
  }

  return (
    <LandingScreen
      onBecomeTutor={() => navigate("/apply")}
      onSignIn={() => navigate("/teach")}
    />
  );
}

const CSS = `
  .pl-rootgate {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 14px;
    background: #0B0F16; color: #98A2B5;
    font-family: 'Karla', system-ui, sans-serif; font-size: 0.92rem;
  }
  .pl-rootgate p { margin: 0; }
  .pl-rootgate__spin { animation: plRootSpin 0.9s linear infinite; }
  @keyframes plRootSpin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .pl-rootgate__spin { animation: none; } }
`;
