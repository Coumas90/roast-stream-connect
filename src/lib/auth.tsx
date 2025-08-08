import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export type Role = "client" | "admin";

export type AuthState = {
  role: Role | null;
  isAuthenticated: boolean;
};

export type AuthContextType = AuthState & {
  signInClient: () => void;
  signInAdmin: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = "tupa_auth_state";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw) as AuthState;
    } catch {}
    return { role: null, isAuthenticated: false };
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    signInClient: () => {
      setState({ role: "client", isAuthenticated: true });
      navigate("/app", { replace: true });
    },
    signInAdmin: () => {
      setState({ role: "admin", isAuthenticated: true });
      navigate("/admin", { replace: true });
    },
    signOut: () => {
      setState({ role: null, isAuthenticated: false });
      navigate("/", { replace: true });
    },
  }), [state, navigate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
