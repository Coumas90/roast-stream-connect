import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeatureFlags, type FeatureKey } from "@/hooks/useFeatureFlags";

type Props = {
  feature: FeatureKey;
  canAccess?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function RequireFeature({ feature, canAccess = true, children, fallback = null }: Props) {
  const { isLoading, error, flags, refetch } = useFeatureFlags();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error al cargar permisos</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>No se pudieron cargar los flags de la sucursal.</span>
          <div className="shrink-0">
            <Button size="sm" onClick={() => refetch()}>Reintentar</Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const allowed = Boolean((flags as any)[feature]) && canAccess;
  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}
