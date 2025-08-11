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
import { Box, Flex, Heading, Text, HStack, Stack } from "@chakra-ui/react";
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
    <article>
      <Helmet>
        <title>Mi Equipo - {location} | TUPÁ Hub</title>
        <meta name="description" content="Gestión del equipo y roles por sucursal" />
        <link rel="canonical" href="/app/my-team" />
      </Helmet>
      
      <Flex as="header" align="center" justify="space-between" mb={6}>
        <Stack gap={1}>
          <HStack gap={2}>
            <Users className="w-8 h-8" />
            <Heading as="h1" size="lg" fontWeight="extrabold">
              Mi Equipo
            </Heading>
          </HStack>
          <Text color="hsl(var(--muted-foreground))" mt={1}>
            Gestiona el equipo de <strong>{location}</strong>
          </Text>
          {!canInvite && (
            <Text fontSize="sm" color="hsl(var(--muted-foreground))" mt={2}>
              No tienes permisos para invitar miembros. Contacta a un administrador.
            </Text>
          )}
        </Stack>
        <HStack gap={2}>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'simple' | 'detailed')} className="mr-2" variant="outline">
            <ToggleGroupItem value="simple" aria-label="Vista Simple" className="hover-scale">
              <LayoutGrid className="w-4 h-4 mr-2" /> Vista Simple
            </ToggleGroupItem>
            <ToggleGroupItem value="detailed" aria-label="Vista Detallada" className="hover-scale">
              <PanelsTopLeft className="w-4 h-4 mr-2" /> Vista Detallada
            </ToggleGroupItem>
          </ToggleGroup>
          {isPlatformAdmin && (
            <Button
              variant="outline"
              className="hover-scale"
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
            className="hover-scale"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        </HStack>
      </Flex>

      <section className="animate-fade-in" key={viewMode}>
        <div className="grid gap-6 lg:grid-cols-2">
          <TeamMembersList 
            onInviteClick={() => setInviteDialogOpen(true)} 
            canInvite={canInvite}
            view={viewMode}
          />
          <PendingInvitations 
            onInviteClick={() => setInviteDialogOpen(true)} 
            canInvite={canInvite}
          />
        </div>
      </section>

      <section className="mt-8">
        <Card className="overflow-hidden shadow-elegant">
          <CardContent>
            <Box bg="transparent" p={{ base: 5, md: 8 }} borderRadius="xl" style={{
              background: "linear-gradient(90deg, hsl(var(--warning)/0.08), hsl(var(--background)), hsl(var(--secondary)/0.08))",
            }}>
              <Flex direction={{ base: 'column', md: 'row' }} align={{ md: 'center' }} justify="space-between" gap={4}>
                <Box>
                  <Heading as="h2" size="md" mb={1}>¿Necesitas incorporar personal?</Heading>
                  <Text color="hsl(var(--muted-foreground))" maxW="2xl">
                    Solicitá el alta de nuevos baristas para tu equipo. TUPÁ te ayudará con el proceso de selección y capacitación.
                  </Text>
                </Box>
                <Button
                  onClick={() => setInviteDialogOpen(true)}
                  variant="pill"
                  className="bg-warning text-warning-foreground hover:bg-warning/90 rounded-full hover-scale"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Solicitar Nuevo Integrante
                </Button>
              </Flex>
            </Box>
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
