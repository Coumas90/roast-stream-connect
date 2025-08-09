
import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Mail, ArrowRight } from "lucide-react";
import TenantFormDialog, { TenantFormValues } from "@/components/admin/clients/TenantFormDialog";
import InviteOwnerDialog from "@/components/admin/clients/InviteOwnerDialog";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Tenant = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
};

export default function AdminClients() {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [editing, setEditing] = React.useState<Tenant | null>(null);
  const [openForm, setOpenForm] = React.useState(false);
  const [inviteTenant, setInviteTenant] = React.useState<Tenant | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [toDelete, setToDelete] = React.useState<Tenant | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenants", { search, page, pageSize }],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase.from("tenants").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(`name.ilike.${s},slug.ilike.${s}`);
      }
      const { data, count, error } = await query;
      if (error) throw error;
      return { items: (data ?? []) as Tenant[], total: count ?? 0 };
    },
  });

  const createTenant = useMutation({
    mutationFn: async (values: TenantFormValues) => {
      const { data, error } = await supabase.from("tenants").insert({ name: values.name, slug: values.slug }).select("*").single();
      if (error) throw error;
      return data as Tenant;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["tenants"] });
    },
    onError: (err: any) => {
      console.log("[AdminClients] create error:", err);
      toast({ title: "Error", description: "No se pudo crear el cliente", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Cliente creado" });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });

  const updateTenant = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TenantFormValues }) => {
      const { error } = await supabase.from("tenants").update({ name: values.name, slug: values.slug }).eq("id", id);
      if (error) throw error;
    },
    onError: (err: any) => {
      console.log("[AdminClients] update error:", err);
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Cliente actualizado" });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onError: (err: any) => {
      console.log("[AdminClients] delete error:", err);
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Cliente eliminado" });
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <article>
      <Helmet>
        <title>Clientes | TUPÁ Hub</title>
        <meta name="description" content="Gestión de tenants y owners" />
        <link rel="canonical" href="/admin/clients" />
      </Helmet>
      <h1 className="sr-only">Clientes</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tenants</CardTitle>
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}><Plus className="h-4 w-4 mr-2" />Nuevo</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar por nombre o slug..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4}>Cargando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={4}>Sin resultados</TableCell></TableRow>
                ) : items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.slug ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setInviteTenant(t)}><Mail className="h-4 w-4 mr-1" />Invitar Owner</Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/clients/${t.id}`)}><ArrowRight className="h-4 w-4 mr-1" />Detalles</Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total: {total}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
              <div className="text-sm">Página {page} / {totalPages}</div>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TenantFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        defaultValues={editing ? { name: editing.name, slug: editing.slug ?? "" } : undefined}
        loading={createTenant.isPending || updateTenant.isPending}
        title={editing ? "Editar Cliente" : "Nuevo Cliente"}
        submitText={editing ? "Actualizar" : "Crear"}
        onSubmit={async (values) => {
          if (editing) {
            await updateTenant.mutateAsync({ id: editing.id, values });
            setOpenForm(false);
            setEditing(null);
          } else {
            await createTenant.mutateAsync(values);
            setOpenForm(false);
          }
        }}
      />

      <InviteOwnerDialog
        open={!!inviteTenant}
        onOpenChange={(v) => { if (!v) setInviteTenant(null); }}
        tenantId={inviteTenant?.id ?? ""}
        tenantSlug={inviteTenant?.slug ?? null}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar cliente "{toDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) {
                  deleteTenant.mutate(toDelete.id);
                  setToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
