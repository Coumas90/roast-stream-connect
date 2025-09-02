
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Helmet } from "react-helmet-async";

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
  "/admin/coffee-varieties": "Variedades de Café",
  "/admin/location-stock": "Stock de Ubicaciones",
  "/admin/profile": "Perfil",
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const section = Object.keys(labels).find((k) => pathname.startsWith(k));
  return (
    <AppShell variant="admin" section={section ? labels[section] : "Dashboard"}>
      <Helmet>
        <title>{`Admin - ${section ? labels[section] : "Dashboard"}`}</title>
        <meta name="description" content="Panel admin profesional — gestiona clientes, integraciones y analytics." />
        <link rel="canonical" href={window.location.origin + pathname} />
      </Helmet>
      <Outlet />
    </AppShell>
  );
}
