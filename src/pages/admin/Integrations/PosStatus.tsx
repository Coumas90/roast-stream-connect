import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function PosStatusPage() {
  const { data: runs } = useQuery({
    queryKey: ["pos_sync_runs_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_sync_runs")
        .select("id, location_id, provider, kind, started_at, finished_at, ok, error, items")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const latestByKey = useMemo(() => {
    const map = new Map<string, any>();
    (runs ?? []).forEach((r) => {
      const key = `${r.location_id}_${r.provider}_${r.kind}`;
      if (!map.has(key)) map.set(key, r);
    });
    return Array.from(map.values());
  }, [runs]);

  const { data: errors } = useQuery({
    queryKey: ["pos_logs_errors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_logs")
        .select("id, ts, location_id, provider, scope, level, message, meta")
        .eq("level", "error")
        .order("ts", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <article className="space-y-6">
      <Helmet>
        <title>POS Status | TUPÁ Hub</title>
        <meta name="description" content="Estado y logs del POS por sucursal y proveedor" />
        <link rel="canonical" href="/admin/integrations/pos/status" />
      </Helmet>
      <h1 className="sr-only">Estado POS</h1>

      <Card>
        <CardHeader>
          <CardTitle>Último sync por sucursal/proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sucursal</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>OK</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(latestByKey ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.location_id?.slice(0, 8)}</TableCell>
                  <TableCell>{r.provider}</TableCell>
                  <TableCell>{r.kind}</TableCell>
                  <TableCell>{new Date(r.started_at).toLocaleString()}</TableCell>
                  <TableCell>{r.finished_at ? new Date(r.finished_at).toLocaleString() : "—"}</TableCell>
                  <TableCell>{r.ok ? "Sí" : "No"}</TableCell>
                  <TableCell>{r.items ?? 0}</TableCell>
                  <TableCell className="max-w-[320px] truncate" title={r.error || ""}>{r.error || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errores recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(errors ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.ts).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{e.location_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell>{e.provider || "—"}</TableCell>
                  <TableCell>{e.scope}</TableCell>
                  <TableCell className="max-w-[480px] truncate" title={e.message}>{e.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </article>
  );
}
