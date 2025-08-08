import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyTeam() {
  return (
    <article>
      <Helmet>
        <title>Mi Equipo | TUPÁ Hub</title>
        <meta name="description" content="Gestión del equipo y roles" />
        <link rel="canonical" href="/app/my-team" />
      </Helmet>
      <h1 className="sr-only">Mi Equipo</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Miembros</CardTitle></CardHeader>
          <CardContent>Owner, Encargado, Coffee Master, Baristas</CardContent>
        </Card>
      </section>
    </article>
  );
}
