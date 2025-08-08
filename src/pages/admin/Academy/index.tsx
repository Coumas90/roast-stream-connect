import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminAcademy() {
  return (
    <article>
      <Helmet>
        <title>Academia Global | TUPÁ Hub</title>
        <meta name="description" content="Cursos y certificaciones" />
        <link rel="canonical" href="/admin/academy" />
      </Helmet>
      <h1 className="sr-only">Academia Global</h1>
      <Card>
        <CardHeader><CardTitle>Cursos</CardTitle></CardHeader>
        <CardContent>Barista I, II, QA Franquicia…</CardContent>
      </Card>
    </article>
  );
}
