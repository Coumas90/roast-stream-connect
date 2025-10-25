
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type Role = "client" | "admin";

export type AuthState = {
  role: Role | null;
  isAuthenticated: boolean;
};

export type AuthContextType = AuthState & {
  signInClient: (nextPath?: string) => Promise<void>;
  signInAdmin: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = "tupa_auth_state";
const REDIRECT_KEY = "tupa_auth_redirect";

async function resolveAppRole(userId: string): Promise<Role> {
  // Determina "admin" si el usuario tiene el rol tupa_admin en user_roles; caso contrario "client"
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.log("[Auth] error fetching roles:", error);
    return "client";
  }

  const roles = (data ?? []).map((r: any) => r.role as string);
  const isAdmin = roles.includes("tupa_admin");
  return isAdmin ? "admin" : "client";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>(() => {
    // Conservamos compat localStorage por si ya existía algo
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw) as AuthState;
    } catch {}
    return { role: null, isAuthenticated: false };
  });

  useEffect(() => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  }, [state]);

  // Sincroniza estado con Supabase auth + roles
  useEffect(() => {
    let isMounted = true;

    // 1) Listener primero
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[Auth] onAuthStateChange:", _event);
      if (!isMounted) return;
      // Actualiza estado de forma sincrónica
      setState((prev) => ({ role: session?.user ? prev.role : null, isAuthenticated: !!session?.user }));

      // Diferir resolución de rol para evitar deadlocks
      if (session?.user) {
        setTimeout(() => {
          resolveAppRole(session.user!.id).then((role) => {
            if (!isMounted) return;
            setState({ role, isAuthenticated: true });
            const next = localStorage.getItem(REDIRECT_KEY);
            if (next) {
              localStorage.removeItem(REDIRECT_KEY);
              navigate(next, { replace: true });
            }
          });
        }, 0);
      }
    });

    // 2) Luego, recuperar sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setState((prev) => ({ role: session?.user ? prev.role : null, isAuthenticated: !!session?.user }));
      if (session?.user) {
        setTimeout(() => {
          resolveAppRole(session.user!.id).then((role) => {
            if (!isMounted) return;
            setState({ role, isAuthenticated: true });
            const next = localStorage.getItem(REDIRECT_KEY);
            if (next) {
              localStorage.removeItem(REDIRECT_KEY);
              navigate(next, { replace: true });
            }
          });
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    signInClient: async (nextPath?: string) => {
      // Guardamos a dónde ir tras Google OAuth
      localStorage.setItem(REDIRECT_KEY, nextPath ?? "/app");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${import.meta.env.VITE_SITE_URL}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        console.error("[Auth] Google signInClient error:", error);
      } else {
        console.log("[Auth] Google OAuth launched (client)");
      }
    },
    signInAdmin: async () => {
      localStorage.setItem(REDIRECT_KEY, "/admin");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${import.meta.env.VITE_SITE_URL}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        console.error("[Auth] Google signInAdmin error:", error);
      } else {
        console.log("[Auth] Google OAuth launched (admin)");
      }
    },
    signOut: () => {
      // Cierra sesión en Supabase y resetea estado local
      supabase.auth.signOut();
      localStorage.removeItem(REDIRECT_KEY);
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

