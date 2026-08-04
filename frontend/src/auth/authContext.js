import { createContext, useContext } from "react";

/** Shared auth context. Kept apart from the provider component so this module
    exports no components — which keeps React Fast Refresh working. */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>.");
  return ctx;
}
