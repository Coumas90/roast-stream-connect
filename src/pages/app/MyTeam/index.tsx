import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { useTenant } from "@/lib/tenant";
import { useUserRole } from "@/hooks/useTeam";
import { TeamMembersList } from "@/components/app/team/TeamMembersList";
import { PendingInvitations } from "@/components/app/team/PendingInvitations";
import { InviteDialog } from "@/components/app/team/InviteDialog";
import { supabase } from "@/integrations/supabase/client";

export default function MyTeam() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { location, locationId } = useTenant();
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

  return (
    <article>
      <Helmet>
        <title>Mi Equipo - {location} | TUPÁ Hub</title>
        <meta name="description" content="Gestión del equipo y roles por sucursal" />
        <link rel="canonical" href="/app/my-team" />
      </Helmet>
      
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Mi Equipo
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el equipo de <strong>{location}</strong>
          </p>
        </div>
        {canInvite && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        )}
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <TeamMembersList />
        <PendingInvitations />
      </section>

      <InviteDialog 
        open={inviteDialogOpen} 
        onOpenChange={setInviteDialogOpen} 
      />
    </article>
  );
}
