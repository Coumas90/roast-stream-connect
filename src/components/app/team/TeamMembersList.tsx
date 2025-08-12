import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTeamMembers, TeamMember } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Mail, Phone, CalendarDays, TrendingUp, Coffee, Eye, Pencil, Calendar as CalendarIcon, ChevronDown, Palette } from "lucide-react";

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
  view?: 'simple' | 'detailed';
  onViewMember?: (member: TeamMember) => void;
  onEditMember?: (member: TeamMember) => void;
}
export function TeamMembersList({ onInviteClick, canInvite = false, view = 'detailed', onViewMember, onEditMember }: TeamMembersListProps) {
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
          <p className="text-muted-foreground text-center py-4 text-sm lg:text-base">
            Error al cargar los miembros del equipo
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!members?.length) {
    return (
      <Card className="shadow-elegant transition-all md:hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Miembros del equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 lg:px-8 py-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-warning grid place-items-center">
              <Users className="w-8 h-8 text-warning-foreground" />
            </div>
            <p className="text-muted-foreground max-w-sm text-sm lg:text-base">
              Aún no tienes miembros en esta sucursal. Invita a tu primer colaborador.
            </p>
            <Button
              onClick={onInviteClick}
              disabled={!canInvite}
              title={!canInvite ? 'No tienes permisos para invitar' : undefined}
              variant="pill"
              className="bg-warning text-warning-foreground hover:bg-warning/90 hover-scale rounded-full w-auto lg:w-fit"
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
        <CardTitle className="flex items-center gap-2 font-bold">
          <Users className="w-5 h-5" />
          Miembros del equipo ({members.length})
        </CardTitle>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">
          Personas con acceso a esta sucursal
        </p>
      </CardHeader>
      <CardContent className="animate-fade-in p-4 lg:p-8 pt-4 lg:pt-8" key={view}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {members.map((member) => (
            <article
              key={member.id}
              className="w-full lg:min-w-[300px] min-w-0 h-auto overflow-hidden rounded-xl border bg-card p-4 lg:p-8 shadow-elegant transition-all duration-200 md:hover:shadow-xl md:hover:-translate-y-0.5 text-sm lg:text-base"
            >
              <header className="flex flex-wrap items-center gap-3 lg:gap-4">
                <Avatar className="h-10 w-10 lg:h-[60px] lg:w-[60px] ring-2 ring-warning ring-offset-2 ring-offset-card">
                  <AvatarFallback className="bg-warning text-background font-semibold">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate lg:whitespace-normal lg:overflow-visible lg:break-words">
                    {member.full_name || member.email || "Usuario sin nombre"}
                  </h3>
                  {member.email && (
                    <p className="text-sm lg:text-base text-muted-foreground flex items-center gap-1 break-words truncate lg:whitespace-normal lg:overflow-visible">
                      <Mail className="w-3.5 h-3.5" />
                      {member.email}
                    </p>
                  )}
                </div>
                <Badge variant={ROLE_VARIANTS[member.role as keyof typeof ROLE_VARIANTS] || 'outline'} className="rounded-full shrink-0 mt-2 sm:mt-0 text-[10px] lg:text-xs px-2 py-0.5 lg:px-3 lg:py-1">
                  {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                </Badge>
              </header>

                {view === 'simple' ? (
                  <section className="mt-4 grid gap-3 lg:gap-4">
                    <div className="space-y-1">
                      <h4 className="text-[11px] lg:text-xs uppercase tracking-wide text-muted-foreground">Especialidad</h4>
                      <div className="font-medium">
                        {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-sm lg:text-base flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" /> Progreso Academia
                        </span>
                        <span className="text-xs font-semibold">0%</span>
                      </div>
                      <div className="relative h-2 lg:h-3 w-full rounded-full bg-secondary overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-[0%] bg-gradient-to-r from-primary to-primary/70" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] lg:text-xs uppercase tracking-wide text-muted-foreground mb-2">Certificaciones</h4>
                      <div className="flex flex-wrap gap-2 lg:gap-3">
                        {(member.role === 'coffee_master' || member.role === 'barista') ? (
                          <>
                            <Badge variant="warning" className="rounded-full text-xs lg:text-sm px-2.5 lg:px-3 py-0.5 lg:py-1">
                              <Coffee className="w-3.5 h-3.5 mr-1" /> Barista Avanzado
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-primary text-primary text-xs lg:text-sm px-2.5 lg:px-3 py-0.5 lg:py-1">
                              <Palette className="w-3.5 h-3.5 mr-1" /> Latte Art
                            </Badge>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin certificaciones</span>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
                <section className="mt-4 grid gap-4 lg:gap-6 lg:grid-cols-3">
                  {/* Columna izquierda: Información personal (plegable) */}
                  <div className="rounded-xl bg-secondary/60 p-4 lg:p-8 border">
                    <Collapsible defaultOpen>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs lg:text-sm uppercase tracking-wide text-muted-foreground lg:whitespace-normal lg:overflow-visible lg:break-words">Información personal</h4>
                        <CollapsibleTrigger className="text-muted-foreground">
                          <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <ul className="space-y-2 text-sm lg:text-base pt-2">
                          <li className="flex items-center gap-2 truncate lg:whitespace-normal lg:overflow-visible">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate lg:whitespace-normal lg:overflow-visible lg:break-words">{member.email || '—'}</span>
                          </li>
                          <li className="flex items-center gap-2 truncate lg:whitespace-normal lg:overflow-visible">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate lg:whitespace-normal lg:overflow-visible">—</span>
                          </li>
                          <li className="flex items-center gap-2 truncate lg:whitespace-normal lg:overflow-visible">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate lg:whitespace-normal lg:overflow-visible">Fecha ingreso: —</span>
                          </li>
                          <li className="flex items-center gap-2 truncate lg:whitespace-normal lg:overflow-visible">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="truncate lg:whitespace-normal lg:overflow-visible">Experiencia: — años</span>
                          </li>
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Centro: Especialidad & Progreso */}
                  <div className="rounded-xl bg-secondary/60 p-4 lg:p-8 border">
                    <h4 className="text-xs lg:text-sm uppercase tracking-wide text-muted-foreground mb-2 lg:whitespace-normal lg:overflow-visible lg:break-words">Especialidad & Progreso</h4>
                    <div className="mb-3 font-semibold">
                      {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] || member.role}
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1 text-muted-foreground text-sm">
                        <TrendingUp className="w-4 h-4" /> Progreso
                      </span>
                    </div>
                    <div className="relative h-2 lg:h-3 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-[0%] bg-gradient-to-r from-primary to-primary/70" />
                      <span className="absolute inset-0 grid place-items-center text-[10px] lg:text-[11px] font-bold text-primary-foreground">0%</span>
                    </div>
                  </div>

                  {/* Derecha: Certificaciones (plegable) */}
                  <div className="rounded-xl bg-secondary/60 p-4 lg:p-8 border">
                    <Collapsible defaultOpen>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs lg:text-sm uppercase tracking-wide text-muted-foreground lg:whitespace-normal lg:overflow-visible lg:break-words">Certificaciones</h4>
                        <CollapsibleTrigger className="text-muted-foreground">
                          <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                        <div className="flex flex-wrap gap-2 lg:gap-4 pt-2">
                          {(member.role === 'coffee_master' || member.role === 'barista') ? (
                            <>
                              <Badge variant="warning" className="rounded-full text-xs lg:text-sm px-2.5 lg:px-3 py-0.5 lg:py-1 transition-transform hover:scale-105">
                                <Coffee className="w-3.5 h-3.5 mr-1" /> Barista Avanzado
                              </Badge>
                              <Badge variant="outline" className="rounded-full border-primary text-primary text-xs lg:text-sm px-2.5 lg:px-3 py-0.5 lg:py-1 transition-transform hover:scale-105">
                                <Palette className="w-3.5 h-3.5 mr-1" /> Latte Art
                              </Badge>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin certificaciones</span>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </section>
              )}

              {/* Acciones */}
              <footer className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2 lg:gap-4 sm:justify-end">
                <Button size="sm" variant="ghost" className="hover-scale h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm" onClick={() => onViewMember?.(member)}>
                  <Eye className="w-4 h-4 mr-2" /> Ver Perfil Completo
                </Button>
                <Button size="sm" variant="outline" className="hover-scale h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm" onClick={() => onEditMember?.(member)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar Información
                </Button>
                <Button size="sm" variant="pill" className="bg-warning text-warning-foreground shadow-elegant hover:bg-warning/90 rounded-full hover-scale h-8 md:h-9 px-3 md:px-4 text-xs md:text-sm">
                  <CalendarIcon className="w-4 h-4 mr-2" /> Asignar Turno
                </Button>
              </footer>
            </article>
          ))}
        </div>

        <div className="mt-4 text-center">
          <Button onClick={onInviteClick} disabled={!canInvite} title={!canInvite ? 'No tienes permisos para invitar' : undefined} variant="soft" className="hover-scale">
            <Plus className="w-4 h-4 mr-2" />
            Invitar miembro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}