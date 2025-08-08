
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

    const handleSession = async () => {
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes?.session;
      console.log("[Auth] getSession ->", !!session);

      if (!isMounted) return;

      if (session?.user) {
        const role = await resolveAppRole(session.user.id);
        if (!isMounted) return;

        setState({ role, isAuthenticated: true });

        // Redirección post-auth (si fue establecida por el flujo de login)
        const next = localStorage.getItem(REDIRECT_KEY);
        if (next) {
          localStorage.removeItem(REDIRECT_KEY);
          navigate(next, { replace: true });
        }
      } else {
        setState({ role: null, isAuthenticated: false });
      }
    };

    handleSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[Auth] onAuthStateChange:", _event);
      (async () => {
        if (session?.user) {
          const role = await resolveAppRole(session.user.id);
          if (!isMounted) return;
          setState({ role, isAuthenticated: true });

          const next = localStorage.getItem(REDIRECT_KEY);
          if (next) {
            localStorage.removeItem(REDIRECT_KEY);
            navigate(next, { replace: true });
          }
        } else {
          if (!isMounted) return;
          setState({ role: null, isAuthenticated: false });
        }
      })();
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    signInClient: () => {
      // Guardamos a dónde ir tras Google OAuth
      localStorage.setItem(REDIRECT_KEY, "/app");
      // Redirige a Google para iniciar sesión
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
    },
    signInAdmin: () => {
      localStorage.setItem(REDIRECT_KEY, "/admin");
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
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

