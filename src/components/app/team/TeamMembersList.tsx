import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTeamMembers } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";

const ROLE_LABELS = {
  owner: 'Propietario',
  manager: 'Encargado', 
  coffee_master: 'Coffee Master',
  barista: 'Barista',
  tupa_admin: 'Admin TUPÁ',
} as const;

const ROLE_VARIANTS = {
  owner: 'default',
  manager: 'secondary',
  coffee_master: 'outline',
  barista: 'outline',
  tupa_admin: 'destructive',
} as const;

interface TeamMembersListProps {
  onInviteClick?: () => void;
  canInvite?: boolean;
}
export function TeamMembersList({ onInviteClick, canInvite = false }: TeamMembersListProps) {
  const { data: members, isLoading, error } = useTeamMembers();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del equipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Error al cargar los miembros del equipo
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!members?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Users className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Aún no tienes miembros en esta sucursal. Invita a tu primer colaborador.
            </p>
            <Button onClick={onInviteClick} disabled={!canInvite}>Invitar miembro</Button>
            {!canInvite && (
              <p className="text-sm text-muted-foreground">
                No tienes permisos para invitar miembros. Contacta a un administrador.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return '??';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Miembros del equipo ({members.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
            <Avatar>
              <AvatarFallback>
                {getInitials(member.full_name, member.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {member.full_name || member.email || 'Usuario sin nombre'}
              </p>
              {member.email && member.full_name && (
                <p className="text-sm text-muted-foreground truncate">
                  {member.email}
                </p>
              )}
            </div>
            <Badge variant={ROLE_VARIANTS[member.role as keyof typeof ROLE_VARIANTS] || 'outline'}>
              {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}