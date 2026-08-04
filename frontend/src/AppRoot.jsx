import { AuthProvider } from "./auth/AuthProvider";
import { sideFromPath } from "./auth/sides";
import { useRoute } from "./hooks/useRoute";
import SideChooser from "./screens/SideChooser";
import AuthGate from "./AuthGate";

/* =========================================================================
   APP ROOT — routing sits above the auth provider.

     /        → which door?
     /teach   → teaching side
     /learn   → learning side

   Routing is above AuthProvider so the provider can take the side as a prop
   and filter Workspaces by it. Because both sides render the provider in the
   same position, switching sides re-renders rather than remounts it — so the
   session and loaded profile survive the switch and no second sign-in is
   needed for someone who both teaches and learns.
   ========================================================================= */

export default function AppRoot() {
  const { pathname, navigate } = useRoute();
  const side = sideFromPath(pathname);

  if (!side) return <SideChooser onChoose={navigate} />;

  return (
    <AuthProvider side={side}>
      <AuthGate side={side} navigate={navigate} />
    </AuthProvider>
  );
}
