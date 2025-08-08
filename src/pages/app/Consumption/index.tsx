import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Consumption() {
  return (
    <article>
      <Helmet>
        <title>Consumo | TUPÁ Hub</title>
        <meta name="description" content="KPIs de consumo y métodos más usados" />
        <link rel="canonical" href="/app/consumption" />
      </Helmet>
      <h1 className="sr-only">Consumo</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Consumo semanal</CardTitle></CardHeader>
          <CardContent>2.3 kg • +8% vs semana anterior</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Método más usado</CardTitle></CardHeader>
          <CardContent>Espresso</CardContent>
        </Card>
      </section>
    </article>
  );
}
