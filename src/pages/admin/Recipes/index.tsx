import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminRecipes() {
  return (
    <article>
      <Helmet>
        <title>Recetas Globales | TUPÁ Hub</title>
        <meta name="description" content="Gestión de recetas a nivel TUPÁ" />
        <link rel="canonical" href="/admin/recipes" />
      </Helmet>
      <h1 className="sr-only">Recetas Globales</h1>
      <Card>
        <CardHeader><CardTitle>Recetas</CardTitle></CardHeader>
        <CardContent>Espresso Blend, House Filter…</CardContent>
      </Card>
    </article>
  );
}
