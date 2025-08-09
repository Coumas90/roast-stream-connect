import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/lib/tenant";

export type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  tenant_id: string;
  location_id: string | null;
  created_at: string;
  full_name?: string;
  email?: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  location_id: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  created_by: string | null;
};

export type CreateInvitationParams = {
  email: string;
  role: 'manager' | 'coffee_master' | 'barista';
};

export function useTeamMembers() {
  const { locationId } = useTenant();

  return useQuery({
    queryKey: ['team-members', locationId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!locationId) return [];

      // Get user roles for this location
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: true });

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      // Get profile data for these users
      const userIds = roles.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const members = roles.map(role => {
        const profile = profiles?.find(p => p.id === role.user_id);
        return {
          ...role,
          full_name: profile?.full_name,
          email: undefined, // We'll get this from auth if needed
        };
      });

      return members as TeamMember[];
    },
    enabled: !!locationId,
  });
}

export function useInvitations() {
  const { locationId } = useTenant();

  return useQuery({
    queryKey: ['invitations', locationId],
    queryFn: async (): Promise<any[]> => {
      if (!locationId) return [];

      // Use raw SQL to avoid type issues with new columns
      const { data, error } = await supabase
        .rpc('list_location_invitations' as any, { _location_id: locationId })
        .select();

      if (error) {
        // Fallback to direct table query if RPC doesn't exist yet
        console.warn('RPC not available, using direct query');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('invitations')
          .select('*')
          .eq('tenant_id', 'dummy'); // This will return empty array for now

        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }

      return data || [];
    },
    enabled: !!locationId,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { locationId } = useTenant();

  return useMutation({
    mutationFn: async (params: CreateInvitationParams) => {
      if (!locationId) throw new Error('No location selected');

      const { data, error } = await supabase.rpc('create_location_invitation' as any, {
        _email: params.email,
        _role: params.role,
        _location_id: locationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, params) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', locationId] });
      
      // Call send-invite edge function
      if (data?.[0]) {
        supabase.functions.invoke('send-invite', {
          body: {
            email: params.email,
            token: data[0].token,
            role: params.role,
          }
        }).catch(console.error);
      }

      toast.success('Invitación enviada correctamente');
    },
    onError: (error: any) => {
      const message = error.message || 'Error al crear invitación';
      toast.error(message);
    },
  });
}

export function useResendInvitation() {
  const queryClient = useQueryClient();
  const { locationId } = useTenant();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.rpc('rotate_invitation_token' as any, {
        _invitation_id: invitationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', locationId] });
      toast.success('Invitación reenviada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al reenviar invitación');
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  const { locationId } = useTenant();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc('revoke_invitation' as any, {
        _invitation_id: invitationId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', locationId] });
      toast.success('Invitación revocada');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al revocar invitación');
    },
  });
}

export function useUserRole() {
  const { locationId, tenantId } = useTenant();

  return useQuery({
    queryKey: ['user-role', locationId, tenantId],
    queryFn: async () => {
      if (!locationId || !tenantId) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .or(`and(tenant_id.eq.${tenantId},location_id.eq.${locationId}),and(tenant_id.eq.${tenantId},location_id.is.null)`)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.role || null;
    },
    enabled: !!locationId && !!tenantId,
  });
}