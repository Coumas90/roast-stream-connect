import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useTeamMembers } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Mail, Phone, CalendarDays, TrendingUp, Coffee, Eye, Pencil, Calendar as CalendarIcon } from "lucide-react";
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
      <Card className="shadow-elegant transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="py-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground max-w-sm">
              Aún no tienes miembros en esta sucursal. Invita a tu primer colaborador.
            </p>
            <Button
              onClick={onInviteClick}
              disabled={!canInvite}
              title={!canInvite ? 'No tienes permisos para invitar' : undefined}
              variant="pill"
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Invitar miembro
            </Button>
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
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((member) => (
            <article
              key={member.id}
              className="rounded-xl border bg-card p-4 shadow-elegant transition-transform duration-200 hover:scale-[1.01]"
            >
              <header className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-warning text-background font-semibold">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">
                    {member.full_name || member.email || "Usuario sin nombre"}
                  </h3>
                  {member.email && (
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {member.email}
                    </p>
                  )}
                </div>
                <Badge variant={ROLE_VARIANTS[member.role as keyof typeof ROLE_VARIANTS] || 'outline'} className="rounded-full">
                  {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                </Badge>
              </header>

              <section className="mt-4 grid gap-4 md:grid-cols-3">
                {/* Columna izquierda: Información personal */}
                <div className="rounded-lg bg-secondary/60 p-3">
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Información personal</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{member.email || '—'}</span>
                    </li>
                    <li className="flex items-center gap-2 truncate">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">—</span>
                    </li>
                    <li className="flex items-center gap-2 truncate">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">Fecha ingreso: —</span>
                    </li>
                    <li className="flex items-center gap-2 truncate">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">Experiencia: — años</span>
                    </li>
                  </ul>
                </div>

                {/* Centro: Especialidad & Progreso */}
                <div className="rounded-lg bg-secondary/60 p-3">
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Especialidad & Progreso</h4>
                  <div className="mb-1 font-semibold">
                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-3xl font-extrabold text-warning leading-none">0%</span>
                    <span className="flex items-center gap-1 text-muted-foreground text-sm">
                      <TrendingUp className="w-4 h-4" /> Progreso
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-[0%] bg-gradient-brand" />
                  </div>
                </div>

                {/* Derecha: Certificaciones */}
                <div className="rounded-lg bg-secondary/60 p-3">
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Certificaciones</h4>
                  <div className="flex flex-wrap gap-2">
                    {(member.role === 'coffee_master' || member.role === 'barista') ? (
                      <>
                        <Badge variant="warning" className="rounded-full">
                          <Coffee className="w-3.5 h-3.5 mr-1" /> Barista Avanzado
                        </Badge>
                        <Badge variant="outline" className="rounded-full border-primary text-primary">
                          <Coffee className="w-3.5 h-3.5 mr-1" /> Latte Art
                        </Badge>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin certificaciones</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Acciones */}
              <footer className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button size="sm" variant="ghost">
                  <Eye className="w-4 h-4 mr-2" /> Ver Perfil Completo
                </Button>
                <Button size="sm" variant="outline">
                  <Pencil className="w-4 h-4 mr-2" /> Editar Información
                </Button>
                <Button size="sm" variant="hero">
                  <CalendarIcon className="w-4 h-4 mr-2" /> Asignar Turno
                </Button>
              </footer>
            </article>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Button onClick={onInviteClick} disabled={!canInvite} title={!canInvite ? 'No tienes permisos para invitar' : undefined} variant="soft">
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}