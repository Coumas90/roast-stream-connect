import React from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LocationPosDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <article>
      <Helmet>
        <title>POS de sucursal | TUPÁ Hub</title>
        <meta name="description" content="Detalle de integración POS por sucursal" />
        <link rel="canonical" href={`/app/locations/${id}/pos`} />
      </Helmet>
      <h1 className="sr-only">Detalle POS de sucursal</h1>

      <Card>
        <CardHeader>
          <CardTitle>POS de la sucursal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Próximamente verás aquí el detalle de la conexión POS de esta sucursal.</p>
          <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
        </CardContent>
      </Card>
    </article>
  );
}
