import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { toast } from "@/hooks/use-toast";

const labels: Record<string, string> = {
  "/app": "Dashboard",
  "/app/recipes": "Recetas",
  "/app/consumption": "Consumo",
  "/app/stock": "Stock",
  "/app/replenishment": "Reposición",
  "/app/my-team": "Mi Equipo",
  "/app/academy": "Academia",
  "/app/loyalty": "Loyalty",
  "/app/raffles": "Loterías",
  "/app/settings/integrations": "Integraciones",
  "/app/profile": "Perfil",
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoading, flags, posEffective } = useFeatureFlags();

  useEffect(() => {
    if (isLoading) return;
    const redirect = () => {
      toast({ title: "Módulo no habilitado para esta sucursal", description: "Te redirigimos al inicio." });
      navigate("/app", { replace: true });
    };

    if (pathname.startsWith("/app/replenishment")) {
      if (!flags.auto_order_enabled) {
        toast({ title: "Auto‑orden deshabilitado", description: "Activa el flag de sucursal para usar Reposición." });
        navigate("/app", { replace: true });
      }
    } else if (pathname.startsWith("/app/academy")) {
      if (!flags.academy_enabled) redirect();
    } else if (pathname.startsWith("/app/loyalty")) {
      if (!flags.loyalty_enabled) redirect();
    } else if (pathname.startsWith("/app/raffles")) {
      if (!flags.raffles_enabled) redirect();
    }
  }, [pathname, isLoading, flags, posEffective, navigate]);

  const section = Object.keys(labels).find((k) => pathname.startsWith(k));
  return (
    <AppShell variant="client" section={section ? labels[section] : "Dashboard"}>
      <Outlet />
    </AppShell>
  );
}