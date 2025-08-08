import { Helmet } from "react-helmet-async";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminHome() {
  return (
    <AppShell section="Dashboard" variant="admin">
      <Helmet>
        <title>TUPÁ Hub – Panel Admin</title>
        <meta name="description" content="Administra tenants, integraciones POS y campañas desde el Panel Admin de TUPÁ Hub." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/admin'} />
      </Helmet>
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tenants Activos</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">42</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sucursales</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">128</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Integraciones OK</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">97%</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Asesorías Activas</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">12</CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="soft">Crear Tenant</Button>
            <Button variant="soft">Invitar Owner</Button>
            <Button variant="soft">Ver Integraciones POS</Button>
            <Button variant="soft">Revisar Cola Odoo</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estado de Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm leading-7">
              <li>POS Ingest: operativo</li>
              <li>Odoo API: estable</li>
              <li>Forecast IA: operativo</li>
              <li>Notificaciones: operativo</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
