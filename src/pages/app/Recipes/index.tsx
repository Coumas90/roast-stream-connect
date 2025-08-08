import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Recipes() {
  return (
    <article>
      <Helmet>
        <title>Recetas | TUPÁ Hub</title>
        <meta name="description" content="Recetas de café y parámetros activos" />
        <link rel="canonical" href="/app/recipes" />
      </Helmet>
      <h1 className="sr-only">Recetas</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Receta principal</CardTitle></CardHeader>
          <CardContent>Ratio 1:2 • 18g → 36g • 27s</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Otras recetas</CardTitle></CardHeader>
          <CardContent>Americano, Latte, Cold Brew…</CardContent>
        </Card>
      </section>
    </article>
  );
}
