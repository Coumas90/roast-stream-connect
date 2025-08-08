import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();
  if (!isAuthenticated || role !== "admin") {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return children;
}
