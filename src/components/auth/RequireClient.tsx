import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RequireClient({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();
  if (!isAuthenticated || role !== "client") {
    return <Navigate to="/app/login" replace state={{ from: location }} />;
  }
  return children;
}
