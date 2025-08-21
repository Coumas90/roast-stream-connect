import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, AlertCircle, XCircle, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AlertRule {
  id: string;
  name: string;
  alert_type: string;
  threshold_value: number;
  threshold_operator: string;
  severity: string;
  channels: any;
  cooldown_minutes: number;
  enabled?: boolean;
  metadata: any;
}

interface AlertIncident {
  id: string;
  alert_rule_id: string;
  rule_name: string;
  status: string;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata: any;
  channels_notified: any;
}

export default function AlertManagementDashboard() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<AlertIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertRules();
    fetchRecentIncidents();
  }, []);

  const fetchAlertRules = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_active_alert_rules');

      if (error) throw error;
      // Transform the data to match our interface
      const transformedData = (data || []).map((rule: any) => ({
        ...rule,
        channels: Array.isArray(rule.channels) ? rule.channels : JSON.parse(rule.channels || '[]'),
        enabled: true // Default to true since we only get active rules
      }));
      setAlertRules(transformedData);
    } catch (error) {
      console.error('Error fetching alert rules:', error);
      toast.error('Failed to load alert rules');
    }
  };

  const fetchRecentIncidents = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_recent_alert_incidents', { days_back: 7 });

      if (error) throw error;
      // Transform the data to match our interface
      const transformedData = (data || []).map((incident: any) => ({
        ...incident,
        channels_notified: Array.isArray(incident.channels_notified) ? incident.channels_notified : JSON.parse(incident.channels_notified || '[]')
      }));
      setRecentIncidents(transformedData);
    } catch (error) {
      console.error('Error fetching alert incidents:', error);
      toast.error('Failed to load alert incidents');
    } finally {
      setLoading(false);
    }
  };

  const runProactiveAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('proactive-alerts');

      if (error) throw error;

      toast.success(`Proactive alerts completed. Triggered ${data.alerts_triggered} alerts.`);
      
      // Refresh incidents after running alerts
      setTimeout(() => {
        fetchRecentIncidents();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Error running proactive alerts:', error);
      toast.error('Failed to run proactive alerts');
      setLoading(false);
    }
  };

  const acknowledgeIncident = async (incidentId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('acknowledge_alert_incident', { p_incident_id: incidentId });

      if (error) throw error;

      if (data) {
        toast.success('Alert incident acknowledged');
        fetchRecentIncidents();
      } else {
        toast.error('Failed to acknowledge incident');
      }
    } catch (error) {
      console.error('Error acknowledging incident:', error);
      toast.error('Failed to acknowledge incident');
    }
  };

  const resolveIncident = async (incidentId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('resolve_alert_incident', { p_incident_id: incidentId });

      if (error) throw error;

      if (data) {
        toast.success('Alert incident resolved');
        fetchRecentIncidents();
      } else {
        toast.error('Failed to resolve incident');
      }
    } catch (error) {
      console.error('Error resolving incident:', error);
      toast.error('Failed to resolve incident');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'acknowledged':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'triggered':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variant = severity === 'critical' ? 'destructive' : 
                   severity === 'warning' ? 'secondary' : 'default';
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getSeverityIcon(severity)}
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'resolved' ? 'default' : 
                   status === 'acknowledged' ? 'secondary' : 'destructive';
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Alert Management</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const criticalIncidents = recentIncidents.filter(i => i.severity === 'critical' && i.status === 'triggered').length;
  const activeIncidents = recentIncidents.filter(i => i.status === 'triggered').length;
  const resolvedIncidents = recentIncidents.filter(i => i.status === 'resolved').length;
  const avgResolutionTime = recentIncidents.length > 0 
    ? recentIncidents
        .filter(i => i.resolved_at)
        .reduce((acc, i) => {
          const triggered = new Date(i.triggered_at).getTime();
          const resolved = new Date(i.resolved_at!).getTime();
          return acc + (resolved - triggered);
        }, 0) / recentIncidents.filter(i => i.resolved_at).length / (1000 * 60) // minutes
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Alert Management</h2>
        </div>
        <Button onClick={runProactiveAlerts} disabled={loading}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          Run Proactive Alerts
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalIncidents}</div>
            <p className="text-xs text-muted-foreground">
              Requiring immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIncidents}</div>
            <p className="text-xs text-muted-foreground">
              Total unresolved incidents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved (7d)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedIncidents}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgResolutionTime)}m</div>
            <p className="text-xs text-muted-foreground">
              Average time to resolve
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Recent Incidents</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Alert Incidents</CardTitle>
              <CardDescription>
                Recent alert incidents and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentIncidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent incidents found.</p>
                ) : (
                  recentIncidents.map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getSeverityIcon(incident.severity)}
                        <div>
                          <p className="font-medium">{incident.rule_name}</p>
                          <p className="text-sm text-muted-foreground">{incident.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(incident.triggered_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(incident.severity)}
                        {getStatusBadge(incident.status)}
                        {incident.status === 'triggered' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeIncident(incident.id)}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => resolveIncident(incident.id)}
                            >
                              Resolve
                            </Button>
                          </div>
                        )}
                        {incident.status === 'acknowledged' && (
                          <Button
                            size="sm"
                            onClick={() => resolveIncident(incident.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules Configuration</CardTitle>
              <CardDescription>
                Configured alert rules and their thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No alert rules configured.</p>
                ) : (
                  alertRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getSeverityIcon(rule.severity)}
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Triggers when {rule.alert_type} {rule.threshold_operator} {rule.threshold_value}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cooldown: {rule.cooldown_minutes}min | Channels: {
                              Array.isArray(rule.channels) 
                                ? rule.channels.join(', ') 
                                : JSON.parse(rule.channels || '[]').join(', ')
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(rule.severity)}
                        <Badge variant={rule.enabled !== false ? "default" : "secondary"}>
                          {rule.enabled !== false ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}