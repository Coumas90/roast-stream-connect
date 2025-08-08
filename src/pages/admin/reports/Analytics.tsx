import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminAnalytics() {
  return (
    <article>
      <Helmet>
        <title>Analytics | TUPÁ Hub</title>
        <meta name="description" content="Indicadores y comparativos" />
        <link rel="canonical" href="/admin/reports/analytics" />
      </Helmet>
      <h1 className="sr-only">Analytics</h1>
      <Card>
        <CardHeader><CardTitle>KPIs</CardTitle></CardHeader>
        <CardContent>Consumo vs cobertura, alertas (demo)</CardContent>
      </Card>
    </article>
  );
}
