#!/usr/bin/env npx tsx

/**
 * Smoke Test para Chaos Engineering Infrastructure
 * 
 * Valida que todos los componentes del sistema de chaos testing funcionan correctamente:
 * - Edge Functions (simulator + orchestrator)
 * - Database schemas y RPCs
 * - Test harness básico
 * - Configuración de scenarios
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ipjidjijilhpblxrnaeg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SmokeTestResult {
  component: string;
  status: 'PASS' | 'FAIL';
  details: string;
  duration?: number;
}

class ChaosInfrastructureSmokeTest {
  private results: SmokeTestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🔥 Starting Chaos Infrastructure Smoke Tests...\n');

    await this.testDatabaseSchema();
    await this.testChaosScenarios();
    await this.testFudoSimulator();
    await this.testOrchestrator();
    await this.testMetricsCollection();

    this.printResults();
  }

  private async testDatabaseSchema(): Promise<void> {
    console.log('📊 Testing Database Schema...');
    const start = Date.now();

    try {
      // Test chaos_scenarios table
      const { data: scenarios, error: scenariosError } = await supabase
        .from('chaos_scenarios')
        .select('*')
        .limit(1);

      if (scenariosError) throw new Error(`chaos_scenarios: ${scenariosError.message}`);

      // Test chaos_test_runs table
      const { data: runs, error: runsError } = await supabase
        .from('chaos_test_runs')
        .select('*')
        .limit(1);

      if (runsError) throw new Error(`chaos_test_runs: ${runsError.message}`);

      // Test chaos_test_metrics table
      const { data: metrics, error: metricsError } = await supabase
        .from('chaos_test_metrics')
        .select('*')
        .limit(1);

      if (metricsError) throw new Error(`chaos_test_metrics: ${metricsError.message}`);

      this.addResult('Database Schema', 'PASS', 'All tables accessible', Date.now() - start);
    } catch (error) {
      this.addResult('Database Schema', 'FAIL', error.message, Date.now() - start);
    }
  }

  private async testChaosScenarios(): Promise<void> {
    console.log('📋 Testing Chaos Scenarios Configuration...');
    const start = Date.now();

    try {
      const { data: scenarios, error } = await supabase
        .from('chaos_scenarios')
        .select('*')
        .eq('enabled', true);

      if (error) throw new Error(error.message);

      const requiredScenarios = ['fudo_500_errors', 'rate_limit_429', 'timeout_30s', 'rotation_overload'];
      const foundScenarios = scenarios?.map(s => s.id) || [];
      
      const missing = requiredScenarios.filter(req => !foundScenarios.includes(req));
      
      if (missing.length > 0) {
        throw new Error(`Missing scenarios: ${missing.join(', ')}`);
      }

      this.addResult('Chaos Scenarios', 'PASS', `Found ${scenarios?.length} scenarios`, Date.now() - start);
    } catch (error) {
      this.addResult('Chaos Scenarios', 'FAIL', error.message, Date.now() - start);
    }
  }

  private async testFudoSimulator(): Promise<void> {
    console.log('🎭 Testing Fudo Simulator Edge Function...');
    const start = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('chaos-fudo-simulator', {
        body: {
          config: {
            scenario: 'smoke_test',
            errorRate: 0.0, // No errors for smoke test
            errorType: 'fudo_500'
          }
        }
      });

      if (error) throw new Error(error.message);

      if (!data?.access_token) {
        throw new Error('Expected access_token in response');
      }

      this.addResult('Fudo Simulator', 'PASS', 'Function responds correctly', Date.now() - start);
    } catch (error) {
      this.addResult('Fudo Simulator', 'FAIL', error.message, Date.now() - start);
    }
  }

  private async testOrchestrator(): Promise<void> {
    console.log('🎯 Testing Orchestrator Edge Function...');
    const start = Date.now();

    try {
      // Test starting a chaos test
      const { data, error } = await supabase.functions.invoke('chaos-test-orchestrator', {
        body: {
          action: 'start',
          scenarioId: 'fudo_500_errors',
          configuration: {
            errorRate: 0.1,
            duration: 1000 // 1 second for smoke test
          }
        }
      });

      if (error) throw new Error(error.message);

      if (!data?.testRunId) {
        throw new Error('Expected testRunId in response');
      }

      // Wait a moment and check status
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: statusData, error: statusError } = await supabase.functions.invoke('chaos-test-orchestrator', {
        body: {
          action: 'status',
          testRunId: data.testRunId
        }
      });

      if (statusError) throw new Error(statusError.message);

      this.addResult('Orchestrator', 'PASS', `Test run ${data.testRunId} executed`, Date.now() - start);
    } catch (error) {
      this.addResult('Orchestrator', 'FAIL', error.message, Date.now() - start);
    }
  }

  private async testMetricsCollection(): Promise<void> {
    console.log('📈 Testing Metrics Collection...');
    const start = Date.now();

    try {
      // Check if metrics RPC exists
      const { data, error } = await supabase.rpc('record_chaos_metric', {
        p_test_run_id: 'smoke-test-' + Date.now(),
        p_metric_name: 'smoke_test_metric',
        p_metric_type: 'counter',
        p_value: 1,
        p_unit: 'count'
      });

      if (error) throw new Error(error.message);

      this.addResult('Metrics Collection', 'PASS', 'RPC function working', Date.now() - start);
    } catch (error) {
      this.addResult('Metrics Collection', 'FAIL', error.message, Date.now() - start);
    }
  }

  private addResult(component: string, status: 'PASS' | 'FAIL', details: string, duration?: number): void {
    this.results.push({ component, status, details, duration });
    const emoji = status === 'PASS' ? '✅' : '❌';
    const time = duration ? ` (${duration}ms)` : '';
    console.log(`  ${emoji} ${component}: ${details}${time}`);
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const total = this.results.length;
    
    console.log('\n🔥 Chaos Infrastructure Smoke Test Results:');
    console.log('=' .repeat(50));
    
    this.results.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${emoji} ${result.component}: ${result.details}${duration}`);
    });
    
    console.log('=' .repeat(50));
    console.log(`\n📊 Summary: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All smoke tests PASSED! Chaos infrastructure is ready.');
    } else {
      console.log('⚠️  Some tests FAILED. Review the results above.');
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const smokeTest = new ChaosInfrastructureSmokeTest();
  smokeTest.runAllTests().catch(error => {
    console.error('💥 Smoke test failed:', error);
    process.exit(1);
  });
}