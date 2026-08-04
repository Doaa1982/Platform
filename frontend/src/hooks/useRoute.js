import { useCallback, useEffect, useState } from "react";

/* =========================================================================
   Minimal path router.

   Three routes (/, /teach, /learn) do not justify a routing dependency, and
   the prototype already keeps its own screen state internally. This tracks
   the pathname and pushes history entries so Back works as expected.
   ========================================================================= */

export function useRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    // Fires on Back/Forward, which pushState does not trigger on its own
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", to);
    setPathname(to);
  }, []);

  return { pathname, navigate };
}
