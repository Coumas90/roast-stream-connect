import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminAdvisory() {
  return (
    <article>
      <Helmet>
        <title>Asesorías | TUPÁ Hub</title>
        <meta name="description" content="Solicitudes y SLA" />
        <link rel="canonical" href="/admin/advisory" />
      </Helmet>
      <h1 className="sr-only">Asesorías</h1>
      <Card>
        <CardHeader><CardTitle>Solicitudes</CardTitle></CardHeader>
        <CardContent>Listado de asesorías (demo)</CardContent>
      </Card>
    </article>
  );
}
