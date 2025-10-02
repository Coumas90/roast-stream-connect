import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/hooks/useTeam";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppRole } from "@/integrations/supabase/types";

interface RequireRoleProps {
  children: React.ReactElement;
  allowedRoles: AppRole[];
  redirectTo?: string;
}

export function RequireRole({ children, allowedRoles, redirectTo }: RequireRoleProps) {
  const { isAuthenticated } = useAuth();
  const { data: userRole, isLoading } = useUserRole();
  const location = useLocation();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/app/login" replace state={{ from: location }} />;
  }

  // Loading role from database
  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Check if user has required role
  const hasAccess = userRole && allowedRoles.includes(userRole);

  if (!hasAccess) {
    // Redirect based on actual role
    if (userRole === 'barista' || userRole === 'coffee_master') {
      return <Navigate to="/app/barista" replace />;
    }
    
    // Default redirect
    return <Navigate to={redirectTo || "/app"} replace />;
  }

  return children;
}
