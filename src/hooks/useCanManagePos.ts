import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCanManagePos(locationId?: string) {
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(!!locationId);
  const [error, setError] = useState<string | null>(null);

  const fetchPerm = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase.rpc as any)("user_can_manage_pos", { _location_id: locationId });
      if (error) throw error;
      setCanManage(Boolean(data));
    } catch (e: any) {
      setError(e?.message ?? "Error de permisos");
      setCanManage(null);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    setCanManage(null);
    if (locationId) fetchPerm();
  }, [locationId, fetchPerm]);

  return { canManage, loading, error, refetch: fetchPerm } as const;
}
