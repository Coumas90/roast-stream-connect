import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Calendar, ExternalLink, Info } from "lucide-react";
import { useTrainingRequests, useTrainingEnabled } from "@/hooks/useTrainingRequests";
import { useUserRole } from "@/hooks/useTeam";
import { useTenant } from "@/lib/tenant";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function Academy() {
  const { locationId } = useTenant();
  const { data: userRole } = useUserRole();
  const { data: trainingEnabled = false } = useTrainingEnabled(locationId);
  const { data: requests = [], isLoading } = useTrainingRequests(locationId);
  
  const isManager = userRole === 'owner' || userRole === 'manager';
  const userRequests = isManager ? requests : requests.filter(r => r.requested_by === 'user'); // In real app, filter by actual user ID

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'scheduled': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobada';
      case 'scheduled': return 'Programada';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getTrainingTypeText = (type: string) => {
    switch (type) {
      case 'barista_basics': return 'Fundamentos de Barista';
      case 'latte_art': return 'Latte Art';
      case 'coffee_cupping': return 'Catación de Café';
      case 'equipment_maintenance': return 'Mantenimiento de Equipos';
      case 'custom': return 'Personalizada';
      default: return type;
    }
  };

  return (
    <article>
      <Helmet>
        <title>Academia | TUPÁ Hub</title>
        <meta name="description" content="Cursos y progreso de aprendizaje" />
        <link rel="canonical" href="/app/academy" />
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Academia TUPÁ
            </h1>
            <p className="text-muted-foreground">Centro de aprendizaje y desarrollo profesional</p>
          </div>
          {isManager && trainingEnabled && (
            <Button asChild>
              <Link to="/app/training-management">
                <ExternalLink className="h-4 w-4 mr-2" />
                Gestión de Capacitaciones
              </Link>
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Available Courses */}
          <Card>
            <CardHeader>
              <CardTitle>Cursos Disponibles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">Fundamentos de Barista</h4>
                  <p className="text-sm text-muted-foreground">Técnicas básicas de preparación de café</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">4 horas</Badge>
                    <Badge variant="secondary">Presencial</Badge>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">Latte Art Avanzado</h4>
                  <p className="text-sm text-muted-foreground">Diseños y técnicas de latte art</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">6 horas</Badge>
                    <Badge variant="secondary">Presencial</Badge>
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium">Catación de Café</h4>
                  <p className="text-sm text-muted-foreground">Desarrollo del paladar y análisis sensorial</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">3 horas</Badge>
                    <Badge variant="secondary">Presencial</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Training Status */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isManager ? "Resumen de Capacitaciones" : "Mis Capacitaciones"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!trainingEnabled ? (
                <div className="text-center py-8">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Las capacitaciones no están habilitadas para esta ubicación</p>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                  ))}
                </div>
              ) : userRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isManager ? "No hay solicitudes de capacitación" : "No tienes capacitaciones programadas"}
                  </p>
                  {!isManager && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Para solicitar capacitaciones, contacta a tu encargado
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {userRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{getTrainingTypeText(request.training_type)}</h4>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusText(request.status)}
                        </Badge>
                      </div>
                      {request.scheduled_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(request.scheduled_at), "dd 'de' MMMM, HH:mm", { locale: es })}
                        </div>
                      )}
                      {!request.scheduled_at && request.status === 'pending' && (
                        <p className="text-xs text-muted-foreground">Esperando programación</p>
                      )}
                    </div>
                  ))}
                  {userRequests.length > 3 && (
                    <p className="text-xs text-center text-muted-foreground">
                      +{userRequests.length - 3} más
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Learning Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Recursos de Aprendizaje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Manual del Barista</h4>
                <p className="text-sm text-muted-foreground mb-3">Guía completa de técnicas y procedimientos</p>
                <Button size="sm" variant="outline" className="w-full">Ver Manual</Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Videos Tutoriales</h4>
                <p className="text-sm text-muted-foreground mb-3">Aprende con videos paso a paso</p>
                <Button size="sm" variant="outline" className="w-full">Ver Videos</Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Evaluaciones</h4>
                <p className="text-sm text-muted-foreground mb-3">Pon a prueba tus conocimientos</p>
                <Button size="sm" variant="outline" className="w-full">Tomar Quiz</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
