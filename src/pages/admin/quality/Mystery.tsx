import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminMystery() {
  return (
    <article>
      <Helmet>
        <title>Cliente Oculto | TUPÁ Hub</title>
        <meta name="description" content="Programa de visitas misteriosas" />
        <link rel="canonical" href="/admin/quality/mystery" />
      </Helmet>
      <h1 className="sr-only">Cliente Oculto</h1>
      <Card>
        <CardHeader><CardTitle>Programa</CardTitle></CardHeader>
        <CardContent>Visitas y reportes (demo)</CardContent>
      </Card>
    </article>
  );
}
