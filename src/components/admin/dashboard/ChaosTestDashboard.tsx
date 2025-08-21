import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, Play, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChaosTestRun {
  id: string;
  scenario_name: string;
  status: string;
  created_at: string;
  duration_ms?: number;
  violations: any[];
  results: any;
}

interface ChaosMetric {
  metric_name: string;
  value: number;
  unit: string;
  passed?: boolean;
}

export default function ChaosTestDashboard() {
  const [testRuns, setTestRuns] = useState<ChaosTestRun[]>([]);
  const [recentMetrics, setRecentMetrics] = useState<ChaosMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestRuns();
    fetchRecentMetrics();
  }, []);

  const fetchTestRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('chaos_test_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setTestRuns(data || []);
    } catch (error) {
      console.error('Error fetching test runs:', error);
      toast.error('Failed to load test runs');
    }
  };

  const fetchRecentMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('chaos_test_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecentMetrics(data || []);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const runSmokeTest = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('chaos-test-orchestrator', {
        body: {
          action: 'start',
          scenarioId: 'fudo_500_errors',
          configuration: {
            errorRate: 0.1,
            duration: 5000 // 5 seconds
          }
        }
      });

      if (error) throw error;

      toast.success(`Chaos test started: ${data.testRunId}`);
      
      // Refresh data after a delay
      setTimeout(() => {
        fetchTestRuns();
        fetchRecentMetrics();
        setLoading(false);
      }, 6000);
    } catch (error) {
      console.error('Error starting chaos test:', error);
      toast.error('Failed to start chaos test');
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'failed' ? 'destructive' : 'secondary';
    
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
          <BarChart3 className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Chaos Testing Dashboard</h2>
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

  const successfulRuns = testRuns.filter(run => run.status === 'completed').length;
  const failedRuns = testRuns.filter(run => run.status === 'failed').length;
  const totalViolations = testRuns.reduce((acc, run) => acc + (run.violations?.length || 0), 0);
  const avgDuration = testRuns.length > 0 
    ? testRuns.reduce((acc, run) => acc + (run.duration_ms || 0), 0) / testRuns.length 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Chaos Testing Dashboard</h2>
        </div>
        <Button onClick={runSmokeTest} disabled={loading}>
          <Play className="h-4 w-4 mr-2" />
          Run Smoke Test
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{testRuns.length}</div>
            <p className="text-xs text-muted-foreground">
              Last 10 runs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testRuns.length > 0 ? Math.round((successfulRuns / testRuns.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {successfulRuns}/{testRuns.length} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLO Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViolations}</div>
            <p className="text-xs text-muted-foreground">
              Total violations detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgDuration / 1000)}s</div>
            <p className="text-xs text-muted-foreground">
              Per test execution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Runs</CardTitle>
          <CardDescription>
            Latest chaos engineering test executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {testRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test runs found. Run a smoke test to get started.</p>
            ) : (
              testRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(run.status)}
                    <div>
                      <p className="font-medium">{run.scenario_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.violations?.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {run.violations.length} violations
                      </Badge>
                    )}
                    {getStatusBadge(run.status)}
                    {run.duration_ms && (
                      <span className="text-sm text-muted-foreground">
                        {Math.round(run.duration_ms / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Metrics</CardTitle>
          <CardDescription>
            Key performance indicators from chaos tests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No metrics available.</p>
            ) : (
              recentMetrics.slice(0, 10).map((metric, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{metric.metric_name}</span>
                  <div className="flex items-center gap-2">
                    <span>{metric.value} {metric.unit}</span>
                    {metric.passed !== undefined && (
                      <Badge variant={metric.passed ? "default" : "destructive"} className="text-xs">
                        {metric.passed ? "PASS" : "FAIL"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}