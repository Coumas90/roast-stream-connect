import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";

export type UserRole = 'tupa_admin' | 'owner' | 'manager' | 'coffee_master' | 'barista';

export function useUserRole() {
  const auth = useAuth();
  const { locationId, tenantId } = useTenant();

  return useQuery({
    queryKey: ['user-role', auth.isAuthenticated, locationId, tenantId],
    queryFn: async (): Promise<{ role: UserRole | null; canManageTraining: boolean }> => {
      if (!auth.isAuthenticated) {
        return { role: null, canManageTraining: false };
      }

      // Get current user from Supabase auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("Error getting current user:", authError);
        return { role: null, canManageTraining: false };
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .or(`location_id.eq.${locationId},tenant_id.eq.${tenantId}`);

      if (error) {
        console.error("Error fetching user role:", error);
        return { role: null, canManageTraining: false };
      }

      const roles = (data ?? []).map((r: any) => r.role as UserRole);
      
      // Priority order: tupa_admin > owner > manager > coffee_master > barista
      let primaryRole: UserRole | null = null;
      if (roles.includes('tupa_admin')) primaryRole = 'tupa_admin';
      else if (roles.includes('owner')) primaryRole = 'owner';
      else if (roles.includes('manager')) primaryRole = 'manager';
      else if (roles.includes('coffee_master')) primaryRole = 'coffee_master';
      else if (roles.includes('barista')) primaryRole = 'barista';

      // Only owner and manager can manage training requests
      const canManageTraining = primaryRole === 'owner' || primaryRole === 'manager';

      return { role: primaryRole, canManageTraining };
    },
    enabled: !!auth.isAuthenticated && !!locationId,
  });
}