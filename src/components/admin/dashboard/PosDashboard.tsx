import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Clock, Shield, TrendingUp } from "lucide-react";
import { KPITile } from "./KPITile";
import { cn } from "@/lib/utils";

interface DashboardData {
  summary: {
    health_score: number;
    health_status: string;
    expirations_critical: number;
    expirations_warning: number;
    breakers_open: number;
    avg_mttr_minutes: number;
    mttr_status: string;
  };
  expirations: Array<{
    location_id: string;
    provider: string;
    expires_at: string;
    days_until_expiry: number;
    hours_until_expiry: number;
    location_name: string;
    tenant_name: string;
    status: string;
    rotation_status: string;
    consecutive_rotation_failures: number;
  }>;
  mttr_details: Array<{
    provider: string;
    location_id: string;
    avg_mttr_minutes: number;
    failure_count: number;
    recovery_count: number;
    mttr_status: string;
  }>;
  breaker_status: Array<{
    provider: string;
    location_id: string;
    state: string;
    failures: number;
    location_name: string;
    tenant_name: string;
    status_color: string;
    updated_at: string;
  }>;
}

interface PosDashboardProps {
  data: DashboardData;
  isLoading?: boolean;
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = status === 'green' ? 'default' : status === 'amber' ? 'secondary' : 'destructive';
  const text = status === 'green' ? 'OK' : status === 'amber' ? 'Warning' : 'Critical';
  
  return (
    <Badge variant={variant} className={className}>
      {text}
    </Badge>
  );
}

function formatMTTR(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatTimeUntilExpiry(days: number, hours: number): string {
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
}

export function PosDashboard({ data, isLoading }: PosDashboardProps) {
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const { summary, expirations, mttr_details, breaker_status } = data;

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <section className="grid gap-4 md:grid-cols-4">
        <KPITile
          title="System Health"
          value={`${summary.health_score}%`}
          className={cn(
            "border-l-4",
            summary.health_status === 'green' && "border-l-primary",
            summary.health_status === 'amber' && "border-l-secondary",
            summary.health_status === 'red' && "border-l-destructive"
          )}
        />
        <KPITile
          title="MTTR (7d avg)"
          value={summary.avg_mttr_minutes > 0 ? formatMTTR(summary.avg_mttr_minutes) : "N/A"}
          className={cn(
            "border-l-4",
            summary.mttr_status === 'green' && "border-l-primary",
            summary.mttr_status === 'amber' && "border-l-secondary",
            summary.mttr_status === 'red' && "border-l-destructive"
          )}
        />
        <KPITile
          title="Critical Expirations"
          value={summary.expirations_critical}
          className={cn(
            "border-l-4",
            summary.expirations_critical === 0 && "border-l-primary",
            summary.expirations_critical > 0 && summary.expirations_critical <= 3 && "border-l-secondary",
            summary.expirations_critical > 3 && "border-l-destructive"
          )}
        />
        <KPITile
          title="Open Breakers"
          value={summary.breakers_open}
          className={cn(
            "border-l-4",
            summary.breakers_open === 0 && "border-l-primary",
            summary.breakers_open > 0 && "border-l-destructive"
          )}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Expirations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Upcoming Token Expirations
            </CardTitle>
            <StatusBadge 
              status={summary.expirations_critical > 0 ? 'red' : summary.expirations_warning > 0 ? 'amber' : 'green'} 
              className="text-xs" 
            />
          </CardHeader>
          <CardContent>
            {expirations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p>No upcoming expirations</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Expires In</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expirations.slice(0, 8).map((exp, i) => (
                    <TableRow key={`${exp.location_id}-${exp.provider}`}>
                      <TableCell className="font-mono text-xs">
                        {exp.location_name || exp.location_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="capitalize">{exp.provider}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-medium",
                          exp.hours_until_expiry < 24 && "text-destructive",
                          exp.hours_until_expiry < 72 && exp.hours_until_expiry >= 24 && "text-orange-600"
                        )}>
                          {formatTimeUntilExpiry(exp.days_until_expiry, exp.hours_until_expiry)}
                        </span>
                      </TableCell>
                      <TableCell>
                      <StatusBadge 
                        status={exp.hours_until_expiry < 24 ? 'red' : exp.hours_until_expiry < 72 ? 'amber' : 'green'}
                        className="text-xs"
                      />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Circuit Breaker Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Circuit Breaker Status
            </CardTitle>
            <StatusBadge 
              status={summary.breakers_open > 0 ? 'red' : 'green'}
              className="text-xs" 
            />
          </CardHeader>
          <CardContent>
            {breaker_status.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p>All systems operational</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Failures</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breaker_status.map((breaker, i) => (
                    <TableRow key={`${breaker.location_id}-${breaker.provider}`}>
                      <TableCell className="font-mono text-xs">
                        {breaker.location_name || breaker.location_id?.slice(0, 8) || "Global"}
                      </TableCell>
                      <TableCell className="capitalize">{breaker.provider}</TableCell>
                      <TableCell>
                        <StatusBadge status={breaker.status_color} className="text-xs" />
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-medium",
                          breaker.failures > 5 && "text-destructive",
                          breaker.failures > 2 && breaker.failures <= 5 && "text-orange-600"
                        )}>
                          {breaker.failures}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MTTR Analytics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            MTTR by Location (Last 7 Days)
          </CardTitle>
          <StatusBadge status={summary.mttr_status} className="text-xs" />
        </CardHeader>
        <CardContent>
          {mttr_details.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No rotation data available for the last 7 days</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Avg MTTR</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead>Recoveries</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mttr_details.map((mttr, i) => (
                  <TableRow key={`${mttr.location_id}-${mttr.provider}`}>
                    <TableCell className="font-mono text-xs">
                      {mttr.location_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="capitalize">{mttr.provider}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "font-medium",
                        mttr.mttr_status === 'red' && "text-destructive",
                        mttr.mttr_status === 'amber' && "text-orange-600"
                      )}>
                        {mttr.avg_mttr_minutes > 0 ? formatMTTR(mttr.avg_mttr_minutes) : "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>{mttr.failure_count}</TableCell>
                    <TableCell>{mttr.recovery_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={mttr.mttr_status} className="text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}