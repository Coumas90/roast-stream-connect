import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Loyalty() {
  return (
    <article>
      <Helmet>
        <title>Loyalty | TUPÁ Hub</title>
        <meta name="description" content="Wallet de puntos y beneficios" />
        <link rel="canonical" href="/app/loyalty" />
      </Helmet>
      <h1 className="sr-only">Loyalty</h1>
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Wallet</CardTitle></CardHeader>
          <CardContent>120 pts • Nivel Silver</CardContent>
        </Card>
      </section>
    </article>
  );
}
