import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PosDashboard } from "@/components/admin/dashboard/PosDashboard";
import { usePosDashboard } from "@/hooks/usePosDashboard";
import { RefreshCw, Activity } from "lucide-react";

export default function PosStatusPage() {
  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = usePosDashboard();
  
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
        <title>POS Dashboard | TUPÁ Hub</title>
        <meta name="description" content="Dashboard completo del sistema POS con MTTR, expiraciones y estado de breakers" />
        <link rel="canonical" href="/admin/integrations/pos/status" />
      </Helmet>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">POS Operations Dashboard</h1>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchDashboard()}
          disabled={isDashboardLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isDashboardLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="errors">Error Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-0">
          <PosDashboard data={dashboardData!} isLoading={isDashboardLoading} />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">

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
        </TabsContent>

        <TabsContent value="errors" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </article>
  );
}
