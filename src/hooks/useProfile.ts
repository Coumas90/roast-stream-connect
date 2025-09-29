
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  default_tenant_id?: string | null;
};

async function fetchAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_url, default_tenant_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export function useProfile() {
  const userQuery = useQuery({
    queryKey: ["authUser"],
    queryFn: fetchAuthUser,
    meta: { onError: (e: unknown) => console.error("[useProfile] auth getUser error", e) },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", userQuery.data?.id],
    queryFn: () => fetchProfile(userQuery.data!.id),
    enabled: !!userQuery.data?.id,
    meta: { onError: (e: unknown) => console.error("[useProfile] fetch profile error", e) },
  });

  const email = userQuery.data?.email ?? null;
  return {
    userId: userQuery.data?.id ?? null,
    email,
    profile: profileQuery.data,
    isLoading: userQuery.isLoading || profileQuery.isLoading,
    error: userQuery.error || profileQuery.error,
    refetch: profileQuery.refetch,
  };
}

type UpdatePayload = {
  full_name?: string | null;
  phone?: string | null;
};

export function useUpdateProfile(userId: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ["profileUpdate", userId],
    mutationFn: async (payload: UpdatePayload) => {
      if (!userId) throw new Error("No user");
      // Only update columns that exist in schema
      const toUpdate: Record<string, any> = {};
      if (payload.full_name !== undefined) toUpdate.full_name = payload.full_name;
      if (payload.phone !== undefined) toUpdate.phone = payload.phone;

      const { error } = await supabase.from("profiles").update(toUpdate).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    meta: { onError: (e: unknown) => console.error("[useProfile] update error", e) },
  });
}
