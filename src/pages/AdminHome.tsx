import { Helmet } from "react-helmet-async";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KPITile } from "@/components/admin/dashboard/KPITile";
import { Plus, UserPlus, PlugZap, ListChecks } from "lucide-react";

export default function AdminHome() {
  return (
    <AppShell section="Dashboard" variant="admin">
      <Helmet>
        <title>TUPÁ Hub – Panel Admin</title>
        <meta name="description" content="Administra tenants, integraciones POS y campañas desde el Panel Admin de TUPÁ Hub." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/admin'} />
      </Helmet>
      <h1 className="sr-only">Panel Admin — Dashboard</h1>

      <section className="grid gap-4 md:grid-cols-4">
        <KPITile title="Tenants activos" value={42} delta={5.3} data={[34,36,39,40,41,42]} />
        <KPITile title="Sucursales" value={128} delta={2.1} data={[112,114,117,121,124,128]} />
        <KPITile title="Integraciones OK" value={"97%"} delta={1.2} data={[92,93,95,96,96,97]} />
        <KPITile title="Asesorías activas" value={12} delta={-3.5} data={[15,14,14,13,13,12]} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="soft" className="hover-scale">
              <Plus className="mr-2 h-4 w-4" /> Crear tenant
            </Button>
            <Button variant="soft" className="hover-scale">
              <UserPlus className="mr-2 h-4 w-4" /> Invitar owner
            </Button>
            <Button variant="soft" className="hover-scale">
              <PlugZap className="mr-2 h-4 w-4" /> Ver integraciones POS
            </Button>
            <Button variant="soft" className="hover-scale">
              <ListChecks className="mr-2 h-4 w-4" /> Revisar cola Odoo
            </Button>
          </CardContent>
        </Card>
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Estado de servicios</CardTitle>
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
