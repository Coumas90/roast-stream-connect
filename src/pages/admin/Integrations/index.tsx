import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDataStore } from "@/lib/data-store";

export default function AdminIntegrations() {
  const { posConnected, setPosConnected } = useDataStore();
  return (
    <article>
      <Helmet>
        <title>Integraciones | TUPÁ Hub</title>
        <meta name="description" content="Estado de integraciones y POS" />
        <link rel="canonical" href="/admin/integrations" />
      </Helmet>
      <h1 className="sr-only">Integraciones</h1>
      <Card>
        <CardHeader><CardTitle>POS</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch checked={posConnected} onCheckedChange={setPosConnected} />
          <Label>{posConnected ? "Conectado" : "Desconectado"}</Label>
        </CardContent>
      </Card>
    </article>
  );
}
