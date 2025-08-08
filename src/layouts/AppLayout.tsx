import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

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
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const section = Object.keys(labels).find((k) => pathname.startsWith(k));
  return (
    <AppShell variant="client" section={section ? labels[section] : "Dashboard"}>
      <Outlet />
    </AppShell>
  );
}
