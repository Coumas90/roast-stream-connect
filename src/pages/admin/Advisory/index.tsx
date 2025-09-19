import React from "react";
import { Helmet } from "react-helmet-async";
import { TrainingKPIGrid } from "@/components/admin/advisory/TrainingKPIGrid";
import { TrainingFilters } from "@/components/admin/advisory/TrainingFilters";
import { TrainingRequestsTable } from "@/components/admin/advisory/TrainingRequestsTable";
import { ScheduleTrainingModal } from "@/components/admin/advisory/ScheduleTrainingModal";
import { useTrainingRequests, useUpdateTrainingRequestStatus, TrainingRequest } from "@/hooks/useTrainingRequests";
import { toast } from "@/hooks/use-toast";

export default function AdminAdvisory() {
  const [searchValue, setSearchValue] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [scheduleModalOpen, setScheduleModalOpen] = React.useState(false);
  const [selectedRequest, setSelectedRequest] = React.useState<TrainingRequest | null>(null);

  const { data: requests = [], refetch, isLoading } = useTrainingRequests();
  const updateStatusMutation = useUpdateTrainingRequestStatus();

  const filteredRequests = React.useMemo(() => {
    return requests.filter((request) => {
      const matchesSearch = !searchValue || 
        request.training_type.toLowerCase().includes(searchValue.toLowerCase()) ||
        request.notes?.toLowerCase().includes(searchValue.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesType = typeFilter === "all" || request.training_type === typeFilter;
      const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [requests, searchValue, statusFilter, typeFilter, priorityFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status: status as any });
  };

  const handleSchedule = (request: TrainingRequest) => {
    setSelectedRequest(request);
    setScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (id: string, data: any) => {
    try {
      // TODO: Implement schedule mutation
      toast({
        title: "Capacitación programada",
        description: "La capacitación ha sido programada exitosamente.",
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo programar la capacitación.",
        variant: "destructive",
      });
    }
  };

  return (
    <article className="space-y-6">
      <Helmet>
        <title>Capacitaciones | TUPÁ Hub Admin</title>
        <meta name="description" content="Gestión de solicitudes de capacitación y programación" />
        <link rel="canonical" href="/admin/advisory" />
      </Helmet>
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Capacitaciones</h1>
        <p className="text-muted-foreground">
          Administra solicitudes de capacitación, programa sesiones y realiza seguimiento.
        </p>
      </div>

      <TrainingKPIGrid requests={requests} />

      <div className="space-y-4">
        <TrainingFilters
          onSearchChange={setSearchValue}
          onStatusFilter={setStatusFilter}
          onTypeFilter={setTypeFilter}
          onPriorityFilter={setPriorityFilter}
          onRefresh={refetch}
          searchValue={searchValue}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          priorityFilter={priorityFilter}
        />

        <TrainingRequestsTable
          requests={filteredRequests}
          onStatusChange={handleStatusChange}
          onSchedule={handleSchedule}
        />
      </div>

      <ScheduleTrainingModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        request={selectedRequest}
        onSchedule={handleScheduleSubmit}
      />
    </article>
  );
}
