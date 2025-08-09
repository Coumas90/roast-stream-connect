
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UserAvatar from "@/components/ui/UserAvatar";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useTeam";
import { useTenant } from "@/lib/tenant";

const ProfileSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof ProfileSchema>;

export default function ProfilePage() {
  const { profile, email, userId, isLoading } = useProfile();
  const updateProfile = useUpdateProfile(userId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(ProfileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.full_name, profile?.phone]);

  const onSubmit = async (values: FormValues) => {
    await updateProfile.mutateAsync(values)
      .then(() => toast("Perfil actualizado"))
      .catch((e) => toast("Error al guardar el perfil"));
  };

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleSelectImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUploadAvatar = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !userId) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      toast("Upload pendiente de configuración (bucket/columna no disponible)");
      return;
    }
    toast("Avatar subido (guarda la URL en perfil cuando esté disponible)");
  };

  const handleChangePassword = async () => {
    const newPassword = window.prompt("Ingresa una nueva contraseña (mín. 6 caracteres)");
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast("No se pudo cambiar la contraseña");
    } else {
      toast("Contraseña actualizada");
    }
  };

  const displayName = useMemo(() => profile?.full_name || email || "Usuario", [profile?.full_name, email]);

  const { data: userRole } = useUserRole();
  const { tenantId } = useTenant();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [fallbackRole, setFallbackRole] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role, tenant_id, location_id')
          .eq('user_id', userId);
        if (ignore) return;
        setIsPlatformAdmin(!!data?.some((r: any) => r.role === 'tupa_admin'));
        const roles = (tenantId ? data?.filter((r: any) => r.tenant_id === tenantId) : data) || [];
        const priority = ['owner', 'manager', 'coffee_master', 'barista'] as const;
        const derived = priority.find(p => roles.some((r: any) => r.role === p)) || null;
        setFallbackRole(derived);
      } catch {
        if (!ignore) {
          setIsPlatformAdmin(false);
          setFallbackRole(null);
        }
      }
    };
    load();
    return () => { ignore = true; };
  }, [userId, tenantId]);

  const effectiveRole = userRole ?? (isPlatformAdmin ? 'tupa_admin' : fallbackRole);
  const roleLabel = useMemo(() => {
    const map: Record<string, string> = {
      tupa_admin: 'Administrador de plataforma',
      owner: 'Dueño',
      manager: 'Encargado',
      coffee_master: 'Coffee Master',
      barista: 'Barista',
    };
    return effectiveRole ? (map[effectiveRole] ?? effectiveRole) : '-';
  }, [effectiveRole]);

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Mi perfil</CardTitle>
            {effectiveRole && <Badge variant="secondary">{roleLabel}</Badge>}
          </div>
          <CardDescription>Gestiona tus datos personales</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="perfil" className="w-full">
            <TabsList>
              <TabsTrigger value="perfil">Perfil</TabsTrigger>
              <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-6">
              <div className="flex items-center gap-4">
                <UserAvatar fullName={profile?.full_name ?? undefined} email={email ?? undefined} src={previewUrl ?? undefined} />
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={handlePickImage}>Seleccionar avatar</Button>
                  <Button variant="outline" onClick={handleUploadAvatar}>Subir</Button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
                </div>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nombre</Label>
                    <Input id="full_name" {...form.register("full_name")} />
                    {form.formState.errors.full_name && (
                      <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" {...form.register("phone")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={email ?? ""} readOnly />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Input id="role" value={roleLabel} readOnly />
                  </div>
                </div>

                {/* Placeholders deshabilitados para campos no soportados aún */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60 pointer-events-none">
                  <div className="space-y-2">
                    <Label>Puesto</Label>
                    <Input placeholder="(próximamente)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Zona horaria</Label>
                    <Input placeholder="(próximamente)" />
                  </div>
                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Input placeholder="(próximamente)" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isLoading || updateProfile.isPending}>Guardar</Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="seguridad" className="space-y-4">
              <div className="space-y-1">
                <Label>Último inicio de sesión</Label>
                <LastLogin />
              </div>
              <div>
                <Button variant="outline" onClick={handleChangePassword}>Cambiar contraseña</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function LastLogin() {
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const ts = (data.user as any)?.last_sign_in_at as string | undefined;
      setLastSignInAt(ts ?? null);
    });
  }, []);

  if (!lastSignInAt) return <p className="text-sm text-muted-foreground">-</p>;
  return <p className="text-sm">{new Date(lastSignInAt).toLocaleString()}</p>;
}
