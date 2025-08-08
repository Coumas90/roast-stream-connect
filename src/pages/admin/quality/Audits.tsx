import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminAudits() {
  return (
    <article>
      <Helmet>
        <title>Auditorías | TUPÁ Hub</title>
        <meta name="description" content="Plantillas y runs de QA" />
        <link rel="canonical" href="/admin/quality/audits" />
      </Helmet>
      <h1 className="sr-only">Auditorías</h1>
      <Card>
        <CardHeader><CardTitle>QA Franquicia</CardTitle></CardHeader>
        <CardContent>Plantillas y checklist (demo)</CardContent>
      </Card>
    </article>
  );
}
