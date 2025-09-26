import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, Users, BarChart3, Plus } from "lucide-react";
import { useTrainingRequests, useUpdateTrainingRequestStatus, useScheduleTrainingRequest } from "@/hooks/useTrainingRequests";
import { useTenant } from "@/lib/tenant";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrainingRequestModal } from "@/components/app/dashboard/TrainingRequestModal";
import { ScheduleTrainingModal } from "@/components/admin/advisory/ScheduleTrainingModal";

export default function TrainingManagement() {
  const { locationId } = useTenant();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  
  const { data: requests = [], isLoading } = useTrainingRequests(locationId);
  const updateStatus = useUpdateTrainingRequestStatus();
  const scheduleTraining = useScheduleTrainingRequest();

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'medium': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'low': return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const scheduledRequests = requests.filter(r => r.status === 'scheduled');
  const completedRequests = requests.filter(r => r.status === 'completed');

  const handleScheduleTraining = (requestId: string) => {
    setSelectedRequest(requestId);
    setIsScheduleModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <article>
      <Helmet>
        <title>Gestión de Capacitaciones | TUPÁ Hub</title>
        <meta name="description" content="Gestión completa de solicitudes de capacitación del equipo" />
        <link rel="canonical" href="/app/training-management" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Capacitaciones</h1>
            <p className="text-muted-foreground">Administra las solicitudes de capacitación de tu equipo</p>
          </div>
          <Button onClick={() => setIsRequestModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Solicitudes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Programadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{scheduledRequests.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{completedRequests.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Training Requests Management */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Pendientes ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="scheduled">Programadas ({scheduledRequests.length})</TabsTrigger>
            <TabsTrigger value="all">Todas ({requests.length})</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay solicitudes pendientes</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-yellow-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{getTrainingTypeText(request.training_type)}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(request.status)}>
                              {getStatusText(request.status)}
                            </Badge>
                            <Badge className={getPriorityColor(request.priority)}>
                              {request.priority}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleScheduleTraining(request.id)}
                          >
                            <CalendarDays className="h-4 w-4 mr-1" />
                            Programar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateStatus.mutate({ id: request.id, status: 'cancelled' })}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duración estimada:</span>
                            <span>{request.estimated_duration_hours}h ({request.estimated_days} días)</span>
                          </div>
                          {request.preferred_date && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Fecha preferida:</span>
                              <span>{format(new Date(request.preferred_date), "dd 'de' MMMM, yyyy", { locale: es })}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Solicitado:</span>
                            <span>{format(new Date(request.created_at), "dd/MM/yyyy", { locale: es })}</span>
                          </div>
                        </div>
                        {request.specific_topics.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">Temas específicos:</p>
                            <div className="flex flex-wrap gap-1">
                              {request.specific_topics.map((topic, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {request.notes && (
                          <div>
                            <p className="text-sm font-medium mb-1">Notas:</p>
                            <p className="text-sm text-muted-foreground">{request.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            {scheduledRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay capacitaciones programadas</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {scheduledRequests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-green-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{getTrainingTypeText(request.training_type)}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(request.status)}>
                              {getStatusText(request.status)}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {request.scheduled_at && format(new Date(request.scheduled_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: request.id, status: 'completed' })}
                        >
                          Marcar Completada
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duración:</span>
                            <span>{request.estimated_duration_hours}h</span>
                          </div>
                        </div>
                        {request.notes && (
                          <div>
                            <p className="text-sm font-medium mb-1">Notas:</p>
                            <p className="text-sm text-muted-foreground">{request.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{getTrainingTypeText(request.training_type)}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(request.status)}>
                            {getStatusText(request.status)}
                          </Badge>
                          <Badge className={getPriorityColor(request.priority)}>
                            {request.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "dd/MM/yyyy", { locale: es })}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analytics de Capacitaciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Próximamente: Métricas y reportes detallados</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TrainingRequestModal 
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        locationId={locationId || ''}
      />

      {selectedRequest && (
        <ScheduleTrainingModal
          open={isScheduleModalOpen}
          onOpenChange={(open) => {
            setIsScheduleModalOpen(open);
            if (!open) setSelectedRequest(null);
          }}
          request={requests.find(r => r.id === selectedRequest) || null}
          onSchedule={(id, data) => {
            scheduleTraining.mutate({
              id,
              scheduled_at: data.scheduled_at.toISOString(),
              notes: data.notes
            });
          }}
        />
      )}
    </article>
  );
}