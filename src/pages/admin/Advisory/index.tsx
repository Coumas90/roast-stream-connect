import React from "react";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingKPIGrid } from "@/components/admin/advisory/TrainingKPIGrid";
import { TrainingFilters } from "@/components/admin/advisory/TrainingFilters";
import { TrainingRequestsTable } from "@/components/admin/advisory/TrainingRequestsTable";
import { ScheduleTrainingModal } from "@/components/admin/advisory/ScheduleTrainingModal";
import { FeedbackTab } from "@/components/admin/advisory/FeedbackTab";
import { useTrainingRequests, useUpdateTrainingRequestStatus, useScheduleTrainingRequest, TrainingRequest } from "@/hooks/useTrainingRequests";
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
  const scheduleTrainingMutation = useScheduleTrainingRequest();

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
    if (!selectedRequest) return;
    
    scheduleTrainingMutation.mutate({
      id: selectedRequest.id,
      scheduled_at: data.scheduled_at,
      notes: data.notes
    }, {
      onSuccess: () => {
        setScheduleModalOpen(false);
        setSelectedRequest(null);
      }
    });
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

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList>
          <TabsTrigger value="requests">Solicitudes</TabsTrigger>
          <TabsTrigger value="feedback">Feedback & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <TrainingKPIGrid requests={filteredRequests} />

          <div className="space-y-4">
            <TrainingFilters
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              typeFilter={typeFilter}
              onTypeFilter={setTypeFilter}
              priorityFilter={priorityFilter}
              onPriorityFilter={setPriorityFilter}
              onRefresh={refetch}
            />

            <TrainingRequestsTable
              requests={filteredRequests}
              onStatusChange={handleStatusChange}
              onSchedule={handleSchedule}
            />
          </div>
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>
      </Tabs>

      <ScheduleTrainingModal
        open={scheduleModalOpen}
        onOpenChange={setScheduleModalOpen}
        request={selectedRequest}
        onSchedule={handleScheduleSubmit}
      />
    </article>
  );
}
