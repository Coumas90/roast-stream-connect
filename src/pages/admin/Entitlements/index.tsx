import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminEntitlements() {
  return (
    <article>
      <Helmet>
        <title>Entitlements | TUPÁ Hub</title>
        <meta name="description" content="Habilitaciones por cliente y sucursal" />
        <link rel="canonical" href="/admin/entitlements" />
      </Helmet>
      <h1 className="sr-only">Entitlements</h1>
      <Card>
        <CardHeader><CardTitle>Módulos</CardTitle></CardHeader>
        <CardContent>Activar/desactivar módulos (demo)</CardContent>
      </Card>
    </article>
  );
}
