import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ModuleKey =
  | "pos_connected"
  | "loyalty_enabled"
  | "raffles_enabled"
  | "academy_enabled"
  | "barista_tool_enabled"
  | "mystery_enabled"
  | "qa_franchise_enabled"
  | "barista_pool_enabled"
  | "auto_order_enabled";

const MODULE_LABELS: Record<ModuleKey, string> = {
  pos_connected: "POS Conectado",
  loyalty_enabled: "Loyalty",
  raffles_enabled: "Sorteos",
  academy_enabled: "Academy",
  barista_tool_enabled: "Herramienta Barista",
  mystery_enabled: "Mystery QA",
  qa_franchise_enabled: "QA Franquicias",
  barista_pool_enabled: "Barista Pool",
  auto_order_enabled: "Auto-Orden",
};

export default function AdminEntitlements() {
  const [counts, setCounts] = useState<Record<ModuleKey, number>>({
    pos_connected: 0,
    loyalty_enabled: 0,
    raffles_enabled: 0,
    academy_enabled: 0,
    barista_tool_enabled: 0,
    mystery_enabled: 0,
    qa_franchise_enabled: 0,
    barista_pool_enabled: 0,
    auto_order_enabled: 0,
  });
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCounts = async () => {
    const { data, error } = await supabase
      .from("entitlements")
      .select(
        "pos_connected, loyalty_enabled, raffles_enabled, academy_enabled, barista_tool_enabled, mystery_enabled, qa_franchise_enabled, barista_pool_enabled, auto_order_enabled"
      );
    if (error) {
      console.log("[AdminEntitlements] error:", error);
      setLoading(false);
      return;
    }
    const initial: Record<ModuleKey, number> = {
      pos_connected: 0,
      loyalty_enabled: 0,
      raffles_enabled: 0,
      academy_enabled: 0,
      barista_tool_enabled: 0,
      mystery_enabled: 0,
      qa_franchise_enabled: 0,
      barista_pool_enabled: 0,
      auto_order_enabled: 0,
    };
    const next = (data || []).reduce((acc, row: any) => {
      (Object.keys(acc) as ModuleKey[]).forEach((k) => {
        if (row[k]) acc[k] += 1;
      });
      return acc;
    }, initial);
    setCounts(next);
    setTotal(data?.length || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchCounts();
    const channel = supabase
      .channel("entitlements_admin_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entitlements" },
        () => fetchCounts()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const items = useMemo(() => (Object.keys(MODULE_LABELS) as ModuleKey[]), []);

  return (
    <article>
      <Helmet>
        <title>Entitlements | TUPÁ Hub</title>
        <meta name="description" content="Habilitaciones por cliente y sucursal" />
        <link rel="canonical" href="/admin/entitlements" />
      </Helmet>
      <h1 className="sr-only">Entitlements</h1>
      <Card>
        <CardHeader>
          <CardTitle>Módulos (tiempo real)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((k) => (
                <li key={k} className="flex items-center justify-between rounded-md border p-3">
                  <span>{MODULE_LABELS[k]}</span>
                  <span className="font-medium">{counts[k]} / {total}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </article>
  );
}
