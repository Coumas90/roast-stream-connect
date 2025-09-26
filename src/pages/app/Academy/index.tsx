import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Academy() {
  return (
    <article>
      <Helmet>
        <title>Academia | TUPÁ Hub</title>
        <meta name="description" content="Cursos y progreso de aprendizaje" />
        <link rel="canonical" href="/app/academy" />
      </Helmet>
      <h1 className="sr-only">Academia</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cursos</CardTitle></CardHeader>
          <CardContent>Barista I, Extracción Avanzada…</CardContent>
        </Card>
      </section>
    </article>
  );
}
