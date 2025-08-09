
import React from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import LocationFormDialog, { LocationFormValues } from "@/components/admin/clients/LocationFormDialog";
import { Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Tenant = { id: string; name: string; slug: string | null };
type Location = { id: string; name: string; code: string | null; timezone: string | null; tenant_id: string; created_at: string };
type Entitlements = {
  id: string;
  tenant_id: string;
  location_id: string | null;
  pos_connected: boolean;
  auto_order_enabled: boolean;
  loyalty_enabled: boolean;
  raffles_enabled: boolean;
  academy_enabled: boolean;
  barista_tool_enabled: boolean;
  barista_pool_enabled: boolean;
  qa_franchise_enabled: boolean;
  mystery_enabled: boolean;
};

type PosIntegration = {
  id: string;
  tenant_id: string;
  provider: string;
  connected: boolean;
  updated_at: string;
};

export default function AdminClientDetail() {
  const { tenantId } = useParams();
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
      if (error) throw error;
      return data as Tenant | null;
    },
    enabled: !!tenantId,
  });

  // LOCATIONS
  const { data: locations, isLoading: loadingLocations } = useQuery({
    queryKey: ["locations", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Location[];
    },
    enabled: !!tenantId,
  });

  const [openLocForm, setOpenLocForm] = React.useState(false);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [toDeleteLoc, setToDeleteLoc] = React.useState<Location | null>(null);

  const upsertLocation = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: LocationFormValues }) => {
      if (id) {
        const { error } = await supabase.from("locations").update({ name: values.name, code: values.code, timezone: values.timezone }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("locations").insert({ tenant_id: tenantId, name: values.name, code: values.code, timezone: values.timezone } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Sucursal guardada" });
      qc.invalidateQueries({ queryKey: ["locations", tenantId] });
    },
    onError: (e: any) => {
      console.log("[Detail] upsert location error", e);
      toast({ title: "Error", description: "No se pudo guardar la sucursal", variant: "destructive" });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Sucursal eliminada" });
      qc.invalidateQueries({ queryKey: ["locations", tenantId] });
    },
    onError: (e: any) => {
      console.log("[Detail] delete location error", e);
      toast({ title: "Error", description: "No se pudo eliminar la sucursal", variant: "destructive" });
    },
  });

  // ENTITLEMENTS
  const { data: entitlements, isLoading: loadingEnt } = useQuery({
    queryKey: ["entitlements", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("entitlements").select("*").eq("tenant_id", tenantId);
      if (error) throw error;
      return (data ?? []) as Entitlements[];
    },
    enabled: !!tenantId,
  });

  const toggleEntitlement = useMutation({
    mutationFn: async ({ location_id, key, value }: { location_id: string; key: keyof Omit<Entitlements, "id" | "tenant_id" | "location_id">; value: boolean }) => {
      // Upsert: if no row exists for this location, insert first
      const current = (entitlements ?? []).find((e) => e.location_id === location_id);
      if (!current) {
        const insertData: any = { tenant_id: tenantId, location_id, [key]: value };
        const { error } = await supabase.from("entitlements").insert(insertData);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("entitlements").update({ [key]: value } as any).eq("id", current.id);
        if (error) throw error;
      }
    },
    onMutate: async ({ location_id, key, value }) => {
      await qc.cancelQueries({ queryKey: ["entitlements", tenantId] });
      const prev = qc.getQueryData<Entitlements[]>(["entitlements", tenantId]);
      qc.setQueryData<Entitlements[]>(["entitlements", tenantId], (old) => {
        const list = old ? [...old] : [];
        const idx = list.findIndex((e) => e.location_id === location_id);
        if (idx === -1) {
          list.push({
            id: "temp",
            tenant_id: tenantId as string,
            location_id,
            pos_connected: false,
            auto_order_enabled: false,
            loyalty_enabled: false,
            raffles_enabled: false,
            academy_enabled: false,
            barista_tool_enabled: false,
            barista_pool_enabled: false,
            qa_franchise_enabled: false,
            mystery_enabled: false,
            [key]: value,
          } as any);
        } else {
          (list[idx] as any)[key] = value;
        }
        return list;
      });
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["entitlements", tenantId], ctx.prev);
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entitlements", tenantId] });
    },
  });

  // POS INTEGRATIONS (tenant-level)
  const { data: posIntegration, refetch: refetchPos } = useQuery({
    queryKey: ["pos_integration", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pos_integrations").select("*").eq("tenant_id", tenantId).eq("provider", "odoo").maybeSingle();
      if (error) throw error;
      return data as PosIntegration | null;
    },
    enabled: !!tenantId,
  });

  const updatePos = useMutation({
    mutationFn: async (connected: boolean) => {
      const { error } = await supabase.from("pos_integrations").update({ connected }).eq("tenant_id", tenantId).eq("provider", "odoo");
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "POS actualizado" });
      refetchPos();
    },
    onError: (e: any) => {
      console.log("[Detail] update POS error", e);
      toast({ title: "Error", description: "No se pudo actualizar el POS", variant: "destructive" });
    },
  });

  return (
    <>
    <article>
      <Helmet>
        <title>Cliente | TUPÁ Hub</title>
        <meta name="description" content="Detalle de cliente" />
      </Helmet>
      <h1 className="sr-only">Cliente</h1>
      <Card>
        <CardHeader>
          <CardTitle>{tenant?.name ?? "Cliente"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="locations" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="locations">Sucursales</TabsTrigger>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
              <TabsTrigger value="integrations">Integraciones</TabsTrigger>
              <TabsTrigger value="users">Usuarios</TabsTrigger>
            </TabsList>

            <TabsContent value="locations" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Gestiona las sucursales del cliente</div>
                <Button onClick={() => { setEditing(null); setOpenLocForm(true); }}><Plus className="h-4 w-4 mr-2" />Nueva Sucursal</Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Zona Horaria</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLocations ? (
                      <TableRow><TableCell colSpan={4}>Cargando...</TableCell></TableRow>
                    ) : (locations ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={4}>Sin sucursales</TableCell></TableRow>
                    ) : (locations ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.code ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{l.timezone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(l); setOpenLocForm(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setToDeleteLoc(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <LocationFormDialog
                open={openLocForm}
                onOpenChange={setOpenLocForm}
                defaultValues={editing ? { name: editing.name, code: editing.code ?? "", timezone: editing.timezone ?? "America/Argentina/Buenos_Aires" } : undefined}
                onSubmit={async (values) => {
                  await upsertLocation.mutateAsync({ id: editing?.id, values });
                  setOpenLocForm(false);
                  setEditing(null);
                }}
                loading={upsertLocation.isPending}
                title={editing ? "Editar Sucursal" : "Nueva Sucursal"}
                submitText={editing ? "Actualizar" : "Crear"}
              />
            </TabsContent>

            <TabsContent value="entitlements" className="space-y-4 pt-4">
              <div className="text-sm text-muted-foreground">Activa/desactiva módulos por sucursal</div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>POS/Odoo</TableHead>
                      <TableHead>Auto-order</TableHead>
                      <TableHead>Loyalty</TableHead>
                      <TableHead>Raffles</TableHead>
                      <TableHead>Academy</TableHead>
                      <TableHead>Barista Tool</TableHead>
                      <TableHead>Barista Pool</TableHead>
                      <TableHead>QA</TableHead>
                      <TableHead>Mystery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(locations ?? []).map((l) => {
                      const e = (entitlements ?? []).find((x) => x.location_id === l.id);
                      const get = (k: keyof Omit<Entitlements, "id" | "tenant_id" | "location_id">) => e ? (e as any)[k] as boolean : false;
                      const toggle = (k: keyof Omit<Entitlements, "id" | "tenant_id" | "location_id">, v: boolean) => {
                        toggleEntitlement.mutate({ location_id: l.id, key: k, value: v });
                      };
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell><Switch checked={get("pos_connected")} onCheckedChange={(v) => toggle("pos_connected", v)} /></TableCell>
                          <TableCell><Switch checked={get("auto_order_enabled")} onCheckedChange={(v) => toggle("auto_order_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("loyalty_enabled")} onCheckedChange={(v) => toggle("loyalty_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("raffles_enabled")} onCheckedChange={(v) => toggle("raffles_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("academy_enabled")} onCheckedChange={(v) => toggle("academy_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("barista_tool_enabled")} onCheckedChange={(v) => toggle("barista_tool_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("barista_pool_enabled")} onCheckedChange={(v) => toggle("barista_pool_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("qa_franchise_enabled")} onCheckedChange={(v) => toggle("qa_franchise_enabled", v)} /></TableCell>
                          <TableCell><Switch checked={get("mystery_enabled")} onCheckedChange={(v) => toggle("mystery_enabled", v)} /></TableCell>
                        </TableRow>
                      );
                    })}
                    {(locations ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={10}>Sin sucursales</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-4 pt-4">
              <Card>
                <CardHeader><CardTitle>POS (Odoo)</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-3">
                  {posIntegration ? (
                    <>
                      <Switch checked={!!posIntegration.connected} onCheckedChange={(v) => updatePos.mutate(v)} />
                      <div>{posIntegration.connected ? "Conectado" : "Desconectado"}</div>
                      <Button variant="outline" size="sm" onClick={() => refetchPos()}><RefreshCw className="h-4 w-4 mr-1" />Reintentar</Button>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No hay configuración de POS para este tenant. (El alta debe realizarse por backend)
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4 pt-4">
              <Card>
                <CardHeader><CardTitle>Asignar/Revocar roles por email</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <AssignRoleForm tenantSlug={tenant?.slug ?? null} locations={locations ?? []} />
                  <RevokeRoleForm tenantSlug={tenant?.slug ?? null} locations={locations ?? []} />
                  <div className="text-xs text-muted-foreground">
                    Nota: Para privacidad, la lista de usuarios no incluye emails. Use invitaciones o asigne/revoque por email.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </article>

    <AlertDialog open={!!toDeleteLoc} onOpenChange={(o) => { if (!o) setToDeleteLoc(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar sucursal "{toDeleteLoc?.name}"?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (toDeleteLoc) {
                deleteLocation.mutate(toDeleteLoc.id);
                setToDeleteLoc(null);
              }
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>);
}

function AssignRoleForm({ tenantSlug, locations }: { tenantSlug: string | null; locations: Location[] }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"owner" | "manager" | "coffee_master" | "barista">("manager");
  const [locationId, setLocationId] = React.useState<string>("");

  const onAssign = async () => {
    if (!email) return;
    if (!tenantSlug) {
      toast({ title: "Falta slug", description: "Asigna un slug al tenant antes de operar", variant: "destructive" });
      return;
    }
    const locCode = locationId ? locations.find((l) => l.id === locationId)?.code ?? null : null;
    const { error } = await supabase.rpc("assign_role_by_email", {
      _email: email,
      _role: role,
      _tenant_slug: tenantSlug,
      _location_code: locCode,
    } as any);
    if (error) {
      console.log("[AssignRoleForm] error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol asignado" });
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input placeholder="email@cliente.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="rol (owner/manager/coffee_master/barista)" value={role} onChange={(e) => setRole(e.target.value as any)} />
        <select className="border rounded px-2 py-2 bg-background" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">(Tenant completo)</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} {l.code ? `(${l.code})` : ""}</option>
          ))}
        </select>
        <Button onClick={onAssign}>Asignar</Button>
      </div>
    </div>
  );
}

function RevokeRoleForm({ tenantSlug, locations }: { tenantSlug: string | null; locations: Location[] }) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"owner" | "manager" | "coffee_master" | "barista">("manager");
  const [locationId, setLocationId] = React.useState<string>("");

  const onRevoke = async () => {
    if (!email) return;
    const locCode = locationId ? locations.find((l) => l.id === locationId)?.code ?? null : null;
    const { error } = await supabase.rpc("revoke_role_by_email", {
      _email: email,
      _role: role,
      _tenant_slug: tenantSlug,
      _location_code: locCode,
    } as any);
    if (error) {
      console.log("[RevokeRoleForm] error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rol revocado" });
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input placeholder="email@cliente.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="rol (owner/manager/coffee_master/barista)" value={role} onChange={(e) => setRole(e.target.value as any)} />
        <select className="border rounded px-2 py-2 bg-background" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">(Tenant completo)</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} {l.code ? `(${l.code})` : ""}</option>
          ))}
        </select>
        <Button variant="outline" onClick={onRevoke}>Revocar</Button>
      </div>
    </div>
  );
}
