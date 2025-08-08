import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Stock() {
  return (
    <article>
      <Helmet>
        <title>Stock | TUPÁ Hub</title>
        <meta name="description" content="Cobertura y ledger de stock" />
        <link rel="canonical" href="/app/stock" />
      </Helmet>
      <h1 className="sr-only">Stock</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cobertura</CardTitle></CardHeader>
          <CardContent>4.5 días</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Movimientos</CardTitle></CardHeader>
          <CardContent>Recepciones, consumo, ajustes…</CardContent>
        </Card>
      </section>
    </article>
  );
}
