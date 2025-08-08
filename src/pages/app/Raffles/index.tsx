import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Raffles() {
  return (
    <article>
      <Helmet>
        <title>Loterías | TUPÁ Hub</title>
        <meta name="description" content="Participaciones y sorteos" />
        <link rel="canonical" href="/app/raffles" />
      </Helmet>
      <h1 className="sr-only">Loterías</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>QR de participación</CardTitle></CardHeader>
          <CardContent>Escanea para participar</CardContent>
        </Card>
      </section>
    </article>
  );
}
