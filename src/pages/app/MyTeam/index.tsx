import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Users, CheckCircle2, Trophy, TrendingUp, PlusCircle, LayoutGrid, PanelsTopLeft } from "lucide-react";
import { useTenant } from "@/lib/tenant";
import { useUserRole, useTeamMembers } from "@/hooks/useTeam";
import { TeamMembersList } from "@/components/app/team/TeamMembersList";
import { PendingInvitations } from "@/components/app/team/PendingInvitations";
import { InviteDialog } from "@/components/app/team/InviteDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
export default function MyTeam() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('detailed');
  const { location, locationId, tenantId } = useTenant();
  const { data: userRole } = useUserRole();

  // Real-time updates for team data
  useEffect(() => {
    if (!locationId) return;

    const userRolesChannel = supabase
      .channel('team-user-roles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          // Trigger refetch of team data
          window.dispatchEvent(new CustomEvent('team-data-changed'));
        }
      )
      .subscribe();

    const invitationsChannel = supabase
      .channel('team-invitations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invitations',
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          // Trigger refetch of invitations data
          window.dispatchEvent(new CustomEvent('team-data-changed'));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userRolesChannel);
      supabase.removeChannel(invitationsChannel);
    };
  }, [locationId]);

  const canInvite = userRole === 'owner' || userRole === 'manager';
  const isPlatformAdmin = userRole === 'tupa_admin';
  const navigate = useNavigate();

  // Datos para stats (UI-only)
  const { data: members } = useTeamMembers();
  const total = members?.length ?? 0;
  const activos = total; // sin estado de actividad, usamos total como proxy
  const certificados = members?.filter((m) => m.role === 'coffee_master' || m.role === 'barista').length ?? 0;
  const progresoPromedio = 0; // placeholder sin lógica nueva
  return (
    <article className="mx-auto max-w-[1200px] px-4 lg:px-8">
      <Helmet>
        <title>Mi Equipo - {location} | TUPÁ Hub</title>
        <meta name="description" content="Gestión del equipo y roles por sucursal" />
        <link rel="canonical" href="/app/my-team" />
      </Helmet>
      
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Mi Equipo
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gestiona el equipo de <strong>{location}</strong>
          </p>
          {!canInvite && (
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              No tienes permisos para invitar miembros. Contacta a un administrador.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'simple' | 'detailed')} className="mr-2" variant="outline">
            <ToggleGroupItem value="simple" aria-label="Vista Simple" className="hover-scale text-sm md:text-base">
              <LayoutGrid className="w-4 h-4 mr-2" /> Vista Simple
            </ToggleGroupItem>
            <ToggleGroupItem value="detailed" aria-label="Vista Detallada" className="hover-scale text-sm md:text-base">
              <PanelsTopLeft className="w-4 h-4 mr-2" /> Vista Detallada
            </ToggleGroupItem>
          </ToggleGroup>
          {isPlatformAdmin && (
            <Button
              variant="outline"
              className="hover-scale h-9 md:h-10 px-3 md:px-4 text-sm md:text-base"
              onClick={() => tenantId && navigate(`/admin/clients/${tenantId}`)}
              disabled={!tenantId}
              title={!tenantId ? 'Tenant no disponible' : 'Ver cliente en Admin'}
            >
              Ver cliente
            </Button>
          )}
          <Button 
            onClick={() => setInviteDialogOpen(true)}
            disabled={!canInvite}
            title={!canInvite ? 'No tienes permisos para invitar' : undefined as any}
            className="hover-scale h-9 md:h-10 px-3 md:px-4 text-sm md:text-base"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        </div>
      </header>

      <section className="animate-fade-in" key={viewMode}>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:basis-3/5 lg:basis-3/5">
            <TeamMembersList 
              onInviteClick={() => setInviteDialogOpen(true)} 
              canInvite={canInvite}
              view={viewMode}
            />
          </div>
          <div className="w-full md:basis-2/5 lg:basis-2/5">
            <PendingInvitations 
              onInviteClick={() => setInviteDialogOpen(true)} 
              canInvite={canInvite}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <Card className="overflow-hidden shadow-elegant">
          <CardContent className="bg-gradient-to-r from-warning/10 via-background to-secondary/10 p-4 lg:p-8 pt-4 lg:pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">¿Necesitas incorporar personal?</h2>
                <p className="text-muted-foreground max-w-2xl">
                  Solicitá el alta de nuevos baristas para tu equipo. TUPÁ te ayudará con el proceso de selección y capacitación.
                </p>
              </div>
            <Button
              onClick={() => setInviteDialogOpen(true)}
              variant="pill"
              className="bg-warning text-warning-foreground hover:bg-warning/90 rounded-full hover-scale h-9 md:h-10 px-4 md:px-5 text-sm md:text-base w-full md:w-auto"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Solicitar Nuevo Integrante
            </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <InviteDialog 
        open={inviteDialogOpen} 
        onOpenChange={setInviteDialogOpen} 
      />
    </article>
  );
}
