import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () =>
      queryClient.invalidateQueries({ queryKey: ['team-members', locationId] });
    window.addEventListener('team-data-changed', handler);
    return () => window.removeEventListener('team-data-changed', handler);
  }, [queryClient, locationId]);

  return useQuery({
    queryKey: ['team-members', locationId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!locationId) return [];

      // Usamos el RPC con SECURITY DEFINER para listar miembros de la sucursal,
      // evitando las limitaciones de RLS sobre user_roles y profiles.
      console.log('[useTeamMembers] fetching via RPC list_location_members', { locationId });
      const { data, error } = await supabase.rpc('list_location_members', {
        _location_id: locationId,
      });

      if (error) {
        console.error('[useTeamMembers] RPC error:', error);
        throw error;
      }

      const members = (data ?? []).map((r: any) => ({
        id: r.user_id as string,
        user_id: r.user_id as string,
        role: r.role as string,
        tenant_id: r.tenant_id as string,
        location_id: r.location_id as string | null,
        created_at: r.created_at as string,
        full_name: r.full_name ?? undefined,
        email: r.email ?? undefined,
      })) as TeamMember[];

      console.log('[useTeamMembers] members:', members);
      return members;
    },
    enabled: !!locationId,
  });
}

export function useInvitations() {
  const { locationId } = useTenant();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () =>
      queryClient.invalidateQueries({ queryKey: ['invitations', locationId] });
    window.addEventListener('team-data-changed', handler);
    return () => window.removeEventListener('team-data-changed', handler);
  }, [queryClient, locationId]);

  return useQuery({
    queryKey: ['invitations', locationId],
    queryFn: async (): Promise<any[]> => {
      if (!locationId) return [];

      const { data, error } = await supabase.rpc('list_location_invitations', {
        _location_id: locationId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!locationId,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { locationId, location } = useTenant();

  return useMutation({
    mutationFn: async (params: CreateInvitationParams) => {
      if (!locationId) throw new Error('No location selected');

      const { data, error } = await supabase.rpc('create_location_invitation', {
        _email: params.email,
        _role: params.role,
        _location_id: locationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, params) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', locationId] });
      
      if (data?.[0]) {
        const inviteUrl = `${window.location.origin}/invite/${data[0].token}`;
        supabase.functions.invoke('send-invite', {
          body: {
            to: params.email,
            inviteUrl,
            tenantName: location || '',
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
  const { locationId, location } = useTenant();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.rpc('rotate_invitation_token', {
        _invitation_id: invitationId,
      });

      if (error) throw error;
      return { data, invitationId };
    },
    onSuccess: ({ data, invitationId }) => {
      const cache = queryClient.getQueryData<any[]>(['invitations', locationId]);
      const inv = cache?.find((i) => i.id === invitationId);
      const to = inv?.email as string | undefined;

      if (to && data?.[0]) {
        const inviteUrl = `${window.location.origin}/invite/${data[0].token}`;
        supabase.functions.invoke('send-invite', {
          body: {
            to,
            inviteUrl,
            tenantName: location || '',
          },
        }).catch(console.error);
      }

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

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userRes.user?.id;
      if (!userId) return null;

      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('role, tenant_id, location_id')
        .eq('user_id', userId);

      if (error) throw error;
      if (!roles?.length) return null;

      // Global platform admin has highest precedence
      if (roles.some((r: any) => r.role === 'tupa_admin')) return 'tupa_admin';

      // Consider roles for this tenant: either exact location or tenant-wide (null location)
      const relevant = roles.filter(
        (r: any) => r.tenant_id === tenantId && (r.location_id === locationId || r.location_id === null)
      );
      if (!relevant.length) return null;

      const priority = ['owner', 'manager', 'coffee_master', 'barista'] as const;
      const effective = priority.find(p => relevant.some((r: any) => r.role === p)) || null;
      return effective;
    },
    enabled: !!locationId && !!tenantId,
  });
}
