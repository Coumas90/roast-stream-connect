import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminClients() {
  return (
    <article>
      <Helmet>
        <title>Clientes | TUPÁ Hub</title>
        <meta name="description" content="Gestión de tenants y owners" />
        <link rel="canonical" href="/admin/clients" />
      </Helmet>
      <h1 className="sr-only">Clientes</h1>
      <Card>
        <CardHeader><CardTitle>Tenants</CardTitle></CardHeader>
        <CardContent>Listado de clientes (demo)</CardContent>
      </Card>
    </article>
  );
}
