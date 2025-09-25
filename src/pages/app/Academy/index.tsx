import React from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Trophy } from "lucide-react";
import { useTrainingRequests } from "@/hooks/useTrainingRequests";
import { useUserRole } from "@/hooks/useUserRole";
import { useTenant } from "@/lib/tenant";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Academy() {
  const { locationId } = useTenant();
  const { data: userRole } = useUserRole();
  const { data: requests = [] } = useTrainingRequests(locationId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'scheduled': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
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

  // For now, show all requests. In future, we can filter by user for baristas/coffee masters
  const myRequests = requests;

  return (
    <article>
      <Helmet>
        <title>Academia | TUPÁ Hub</title>
        <meta name="description" content="Cursos y progreso de aprendizaje" />
        <link rel="canonical" href="/app/academy" />
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Academia</h1>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          {/* Available Courses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Cursos Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="p-3 border border-border/50 rounded-lg">
                  <h4 className="font-medium">Barista I - Fundamentos</h4>
                  <p className="text-sm text-muted-foreground">Introducción básica al mundo del café</p>
                </div>
                <div className="p-3 border border-border/50 rounded-lg">
                  <h4 className="font-medium">Latte Art</h4>
                  <p className="text-sm text-muted-foreground">Técnicas de arte en café</p>
                </div>
                <div className="p-3 border border-border/50 rounded-lg">
                  <h4 className="font-medium">Catación Avanzada</h4>
                  <p className="text-sm text-muted-foreground">Análisis sensorial del café</p>
                </div>
              </div>
              {!userRole?.canManageTraining && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Para solicitar capacitaciones, contacta a tu encargado o manager.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Training Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {userRole?.canManageTraining ? 'Solicitudes de Capacitación' : 'Mis Capacitaciones'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myRequests.length > 0 ? (
                <div className="space-y-3">
                  {myRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="p-3 border border-border/50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">
                          {getTrainingTypeText(request.training_type)}
                        </h4>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusText(request.status)}
                        </Badge>
                      </div>
                      
                      {request.scheduled_at && (
                        <p className="text-xs text-muted-foreground">
                          📅 {format(new Date(request.scheduled_at), "d 'de' MMMM, HH:mm", { locale: es })}
                        </p>
                      )}
                      
                      {request.estimated_duration_hours && (
                        <p className="text-xs text-muted-foreground">
                          ⏱️ Duración: {request.estimated_duration_hours}h
                        </p>
                      )}
                    </div>
                  ))}
                  
                  {myRequests.length > 3 && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">
                        +{myRequests.length - 3} más...
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <GraduationCap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {userRole?.canManageTraining 
                      ? 'No hay solicitudes de capacitación' 
                      : 'No tienes capacitaciones programadas'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </article>
  );
}
