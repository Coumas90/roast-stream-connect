
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

const labels: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/clients": "Clientes",
  "/admin/entitlements": "Entitlements",
  "/admin/integrations": "Integraciones",
  "/admin/orders-queue": "Cola de Pedidos",
  "/admin/advisory": "Asesorías",
  "/admin/recipes": "Recetas",
  "/admin/academy": "Academia",
  "/admin/loyalty": "Loyalty",
  "/admin/raffles": "Sorteos",
  "/admin/quality/audits": "Auditorías",
  "/admin/quality/mystery": "Cliente Oculto",
  "/admin/reports/analytics": "Analytics",
  "/admin/profile": "Perfil",
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const section = Object.keys(labels).find((k) => pathname.startsWith(k));
  return (
    <AppShell variant="admin" section={section ? labels[section] : "Dashboard"}>
      <Outlet />
    </AppShell>
  );
}
