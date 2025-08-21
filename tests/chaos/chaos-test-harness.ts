/**
 * Chaos Engineering Test Harness for POS Rotation System
 * 
 * This test harness validates system resilience under chaos conditions:
 * - Fudo 500 errors
 * - Rate limiting (429) with backoff
 * - Network timeouts with retries  
 * - Rotation rate limit overload
 * 
 * Usage:
 *   npm run test:chaos [scenario-id] [options]
 *   
 * Example:
 *   npm run test:chaos fudo_500_errors --duration=10 --location=abc-123
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ipjidjijilhpblxrnaeg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ChaosTestOptions {
  scenarioId: string;
  locationId?: string;
  duration?: number;
  customConfig?: Record<string, any>;
  verbose?: boolean;
}

interface TestResults {
  testRunId: string;
  scenario: string;
  status: 'completed' | 'failed';
  duration: number;
  violations: string[];
  metrics: Record<string, number>;
  summary: string;
}

class ChaosTestHarness {
  private supabase: any;
  
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Execute a chaos test scenario
   */
  async runScenario(options: ChaosTestOptions): Promise<TestResults> {
    const startTime = Date.now();
    
    console.log(`🔥 Starting chaos test: ${options.scenarioId}`);
    if (options.verbose) {
      console.log('Options:', JSON.stringify(options, null, 2));
    }

    try {
      // Start the chaos test
      const { data: testRunId, error } = await this.supabase.rpc('start_chaos_test', {
        p_scenario_id: options.scenarioId,
        p_target_location_id: options.locationId,
        p_custom_config: options.customConfig || {}
      });

      if (error) throw new Error(`Failed to start test: ${error.message}`);

      console.log(`✅ Test started with ID: ${testRunId}`);

      // Execute the scenario via orchestrator
      const orchResponse = await fetch(`${SUPABASE_URL}/functions/v1/chaos-test-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          action: 'start',
          scenarioId: options.scenarioId,
          locationId: options.locationId,
          customConfig: options.customConfig
        })
      });

      if (!orchResponse.ok) {
        throw new Error(`Orchestrator failed: ${orchResponse.status}`);
      }

      // Poll for completion
      const result = await this.pollForCompletion(testRunId, options.verbose);
      
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Test completed in ${Math.round(duration / 1000)}s`);
      
      return {
        ...result,
        duration
      };

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Poll test status until completion
   */
  private async pollForCompletion(testRunId: string, verbose: boolean = false): Promise<TestResults> {
    const maxWaitTime = 30 * 60 * 1000; // 30 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const { data: testRun, error } = await this.supabase
        .from('chaos_test_runs')
        .select('*')
        .eq('id', testRunId)
        .single();

      if (error) {
        throw new Error(`Failed to get test status: ${error.message}`);
      }

      if (verbose) {
        console.log(`📊 Test status: ${testRun.status}`);
      }

      if (testRun.status === 'completed' || testRun.status === 'failed') {
        // Get test metrics
        const { data: metrics } = await this.supabase
          .from('chaos_test_metrics')
          .select('*')
          .eq('test_run_id', testRunId);

        const metricsMap: Record<string, number> = {};
        metrics?.forEach((metric: any) => {
          metricsMap[metric.metric_name] = metric.value;
        });

        const summary = this.generateTestSummary(testRun, metricsMap);
        
        return {
          testRunId,
          scenario: testRun.scenario_name,
          status: testRun.status,
          duration: testRun.duration_ms,
          violations: testRun.violations || [],
          metrics: metricsMap,
          summary
        };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Test timed out waiting for completion');
  }

  /**
   * Generate human-readable test summary
   */
  private generateTestSummary(testRun: any, metrics: Record<string, number>): string {
    const lines = [
      `🎯 Scenario: ${testRun.scenario_name}`,
      `📈 Status: ${testRun.status.toUpperCase()}`,
      `⏱️  Duration: ${Math.round(testRun.duration_ms / 1000)}s`,
      `📊 Metrics:`
    ];

    Object.entries(metrics).forEach(([key, value]) => {
      lines.push(`   ${key}: ${value}`);
    });

    if (testRun.violations && testRun.violations.length > 0) {
      lines.push(`⚠️  Violations:`);
      testRun.violations.forEach((violation: string) => {
        lines.push(`   - ${violation}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * List available chaos scenarios
   */
  async listScenarios(): Promise<any[]> {
    const { data: scenarios, error } = await this.supabase
      .from('chaos_scenarios')
      .select('*')
      .eq('enabled', true)
      .order('id');

    if (error) {
      throw new Error(`Failed to list scenarios: ${error.message}`);
    }

    return scenarios;
  }

  /**
   * Validate system state before running tests
   */
  async validateSystemState(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check circuit breaker state
      const { data: breakers } = await this.supabase.rpc('cb_check_state', {
        _provider: 'fudo'
      });

      if (breakers?.state === 'open') {
        issues.push('Circuit breaker is currently open - system may not respond normally');
      }

      // Check for recent rotation activity
      const { data: recentRuns } = await this.supabase
        .from('pos_sync_runs')
        .select('*')
        .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('started_at', { ascending: false })
        .limit(10);

      if (recentRuns && recentRuns.length === 0) {
        issues.push('No recent POS sync activity detected - system may be inactive');
      }

      // Check credentials status
      const { data: credentials } = await this.supabase
        .from('pos_credentials')
        .select('rotation_status, consecutive_rotation_failures')
        .eq('provider', 'fudo');

      if (credentials) {
        const failedCredentials = credentials.filter((c: any) => c.consecutive_rotation_failures > 0);
        if (failedCredentials.length > 0) {
          issues.push(`${failedCredentials.length} credentials have recent rotation failures`);
        }
      }

    } catch (error) {
      issues.push(`System state validation failed: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Run comprehensive chaos test suite
   */
  async runTestSuite(options: { locationId?: string; verbose?: boolean } = {}): Promise<TestResults[]> {
    console.log('🚀 Starting comprehensive chaos test suite');

    // Validate system state first
    const validation = await this.validateSystemState();
    if (!validation.valid) {
      console.warn('⚠️  System validation warnings:');
      validation.issues.forEach(issue => console.warn(`   - ${issue}`));
      
      const proceed = process.env.FORCE_CHAOS_TESTS === 'true';
      if (!proceed) {
        throw new Error('System validation failed. Set FORCE_CHAOS_TESTS=true to proceed anyway.');
      }
    }

    const scenarios = await this.listScenarios();
    const results: TestResults[] = [];

    for (const scenario of scenarios) {
      console.log(`\n--- Running ${scenario.name} ---`);
      
      try {
        const result = await this.runScenario({
          scenarioId: scenario.id,
          locationId: options.locationId,
          verbose: options.verbose
        });
        
        results.push(result);
        
        if (options.verbose) {
          console.log(result.summary);
        }

        // Wait between tests to avoid interference
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        console.error(`Failed to run scenario ${scenario.name}:`, error.message);
        results.push({
          testRunId: 'failed',
          scenario: scenario.name,
          status: 'failed',
          duration: 0,
          violations: [error.message],
          metrics: {},
          summary: `Failed: ${error.message}`
        });
      }
    }

    // Generate overall report
    console.log('\n🎯 CHAOS TEST SUITE RESULTS');
    console.log('==========================');
    
    const passed = results.filter(r => r.status === 'completed' && r.violations.length === 0);
    const failed = results.filter(r => r.status === 'failed' || r.violations.length > 0);
    
    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total: ${results.length}`);
    
    if (failed.length > 0) {
      console.log('\nFailed tests:');
      failed.forEach(result => {
        console.log(`   - ${result.scenario}: ${result.violations.join(', ')}`);
      });
    }

    return results;
  }
}

// CLI Interface
if (require.main === module) {
  const harness = new ChaosTestHarness();
  
  const args = process.argv.slice(2);
  const scenarioId = args[0];
  
  const options: ChaosTestOptions = {
    scenarioId: scenarioId || 'all',
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
  
  // Parse additional options
  args.forEach((arg, index) => {
    if (arg === '--location' && args[index + 1]) {
      options.locationId = args[index + 1];
    }
    if (arg === '--duration' && args[index + 1]) {
      options.customConfig = { duration_minutes: parseInt(args[index + 1]) };
    }
  });

  if (scenarioId === 'all' || !scenarioId) {
    // Run all scenarios
    harness.runTestSuite(options)
      .then(results => {
        const exitCode = results.some(r => r.status === 'failed') ? 1 : 0;
        process.exit(exitCode);
      })
      .catch(error => {
        console.error('Test suite failed:', error.message);
        process.exit(1);
      });
  } else if (scenarioId === 'list') {
    // List available scenarios
    harness.listScenarios()
      .then(scenarios => {
        console.log('Available chaos scenarios:');
        scenarios.forEach(s => {
          console.log(`  ${s.id}: ${s.name}`);
          console.log(`    ${s.description}`);
        });
      })
      .catch(error => {
        console.error('Failed to list scenarios:', error.message);
        process.exit(1);
      });
  } else {
    // Run specific scenario
    harness.runScenario(options)
      .then(result => {
        console.log('\n' + result.summary);
        const exitCode = result.status === 'failed' ? 1 : 0;
        process.exit(exitCode);
      })
      .catch(error => {
        console.error('Test failed:', error.message);
        process.exit(1);
      });
  }
}

export { ChaosTestHarness };
export type { ChaosTestOptions, TestResults };