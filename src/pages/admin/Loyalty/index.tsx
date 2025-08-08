import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLoyalty() {
  return (
    <article>
      <Helmet>
        <title>Loyalty (Admin) | TUPÁ Hub</title>
        <meta name="description" content="Tiers y campañas" />
        <link rel="canonical" href="/admin/loyalty" />
      </Helmet>
      <h1 className="sr-only">Loyalty Admin</h1>
      <Card>
        <CardHeader><CardTitle>Campañas</CardTitle></CardHeader>
        <CardContent>Doble puntos cumpleaños (demo)</CardContent>
      </Card>
    </article>
  );
}
