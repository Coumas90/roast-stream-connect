import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function TeamMembersList() {
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
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No hay miembros en este equipo
          </p>
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