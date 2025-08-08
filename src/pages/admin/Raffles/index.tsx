import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminRaffles() {
  return (
    <article>
      <Helmet>
        <title>Sorteos (Admin) | TUPÁ Hub</title>
        <meta name="description" content="Sorteos y feedback" />
        <link rel="canonical" href="/admin/raffles" />
      </Helmet>
      <h1 className="sr-only">Sorteos Admin</h1>
      <Card>
        <CardHeader><CardTitle>Sorteos</CardTitle></CardHeader>
        <CardContent>Sorteo mensual (demo)</CardContent>
      </Card>
    </article>
  );
}
