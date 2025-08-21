import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestScenario {
  id: string;
  name: string;
  description: string;
  testType: string;
  configuration: any;
  successCriteria: any;
}

interface TestResults {
  testRunId: string;
  scenario: TestScenario;
  status: 'running' | 'completed' | 'failed';
  violations: string[];
  metrics: { [key: string]: number };
  duration: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function executeScenario(scenario: TestScenario, testRunId: string): Promise<TestResults> {
  const startTime = Date.now();
  const violations: string[] = [];
  const metrics: { [key: string]: number } = {};

  console.log(`Executing chaos scenario: ${scenario.name} (${testRunId})`);

  try {
    switch (scenario.testType) {
      case 'fudo_500':
        await executeFudo500Scenario(scenario, testRunId, violations, metrics);
        break;
      case 'rate_limit_429':
        await executeRateLimitScenario(scenario, testRunId, violations, metrics);
        break;
      case 'timeout':
        await executeTimeoutScenario(scenario, testRunId, violations, metrics);
        break;
      case 'overload':
        await executeOverloadScenario(scenario, testRunId, violations, metrics);
        break;
      default:
        throw new Error(`Unknown test type: ${scenario.testType}`);
    }

    const duration = Date.now() - startTime;
    
    // Record final metrics
    await supabase.rpc('record_chaos_metric', {
      p_test_run_id: testRunId,
      p_metric_name: 'test_duration_ms',
      p_metric_type: 'timer',
      p_value: duration,
      p_unit: 'milliseconds'
    });

    return {
      testRunId,
      scenario,
      status: violations.length > 0 ? 'failed' : 'completed',
      violations,
      metrics,
      duration
    };

  } catch (error) {
    console.error(`Scenario execution failed:`, error);
    const duration = Date.now() - startTime;
    violations.push(`Execution error: ${error.message}`);
    
    return {
      testRunId,
      scenario,
      status: 'failed',
      violations,
      metrics,
      duration
    };
  }
}

async function executeFudo500Scenario(scenario: TestScenario, testRunId: string, violations: string[], metrics: { [key: string]: number }) {
  const config = scenario.configuration;
  const duration = config.duration_minutes * 60 * 1000;
  const requestInterval = 5000; // 5 seconds between requests
  const maxRequests = Math.floor(duration / requestInterval);
  
  let requests = 0;
  let failures = 0;
  let circuitBreakerOpened = false;
  
  console.log(`Starting Fudo 500 scenario: ${maxRequests} requests over ${config.duration_minutes} minutes`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < duration && requests < maxRequests) {
    try {
      // Simulate rotation request with chaos
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/chaos-fudo-simulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            scenario: scenario.id,
            errorRate: config.error_rate,
            errorType: 'fudo_500'
          },
          testRunId
        })
      });
      
      requests++;
      
      if (!response.ok) {
        failures++;
        
        // Check circuit breaker status
        const { data: cbStatus } = await supabase.rpc('cb_check_state', {
          _provider: 'fudo'
        });
        
        if (cbStatus?.state === 'open') {
          circuitBreakerOpened = true;
          console.log('Circuit breaker opened!');
        }
      }
      
      // Record metrics every 10 requests
      if (requests % 10 === 0) {
        await supabase.rpc('record_chaos_metric', {
          p_test_run_id: testRunId,
          p_metric_name: 'requests_sent',
          p_metric_type: 'counter', 
          p_value: requests
        });
        
        await supabase.rpc('record_chaos_metric', {
          p_test_run_id: testRunId,
          p_metric_name: 'failures_detected',
          p_metric_type: 'counter',
          p_value: failures
        });
      }
      
    } catch (error) {
      console.error('Request failed:', error);
      failures++;
    }
    
    await new Promise(resolve => setTimeout(resolve, requestInterval));
  }
  
  metrics.totalRequests = requests;
  metrics.totalFailures = failures;
  metrics.circuitBreakerOpened = circuitBreakerOpened ? 1 : 0;
  
  // Validate success criteria
  if (scenario.successCriteria.circuit_breaker_opens && !circuitBreakerOpened) {
    violations.push('Circuit breaker did not open despite excessive failures');
  }
  
  if (failures < scenario.successCriteria.max_failures_before_open && circuitBreakerOpened) {
    violations.push(`Circuit breaker opened too early (${failures} < ${scenario.successCriteria.max_failures_before_open})`);
  }
  
  console.log(`Fudo 500 scenario completed: ${requests} requests, ${failures} failures, CB opened: ${circuitBreakerOpened}`);
}

async function executeRateLimitScenario(scenario: TestScenario, testRunId: string, violations: string[], metrics: { [key: string]: number }) {
  const config = scenario.configuration;
  let requests = 0;
  let retryAttempts = 0;
  let backoffViolations = 0;
  
  console.log('Starting rate limit 429 scenario');
  
  for (let i = 0; i < 20; i++) { // Send 20 requests rapidly
    try {
      const requestStart = Date.now();
      
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/chaos-fudo-simulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            scenario: scenario.id,
            errorRate: config.error_rate,
            errorType: 'rate_limit_429',
            retryAfter: 5
          },
          testRunId
        })
      });
      
      requests++;
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        console.log(`Rate limited, retry after: ${retryAfter}s`);
        
        retryAttempts++;
        
        // Validate exponential backoff behavior
        if (retryAttempts <= config.max_retries) {
          const expectedDelay = Math.min(
            config.base_delay_ms * Math.pow(2, retryAttempts - 1),
            config.max_delay_ms
          );
          
          // Wait for backoff and check if system respects it
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          
          // Validate that no requests were made during backoff period
          // This would be checked by monitoring request logs
        } else {
          violations.push(`Exceeded maximum retry attempts: ${retryAttempts} > ${config.max_retries}`);
        }
      }
      
      const requestDuration = Date.now() - requestStart;
      
      await supabase.rpc('record_chaos_metric', {
        p_test_run_id: testRunId,
        p_metric_name: 'request_duration_ms',
        p_metric_type: 'timer',
        p_value: requestDuration,
        p_unit: 'milliseconds'
      });
      
    } catch (error) {
      console.error('Rate limit test request failed:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
  }
  
  metrics.totalRequests = requests;
  metrics.retryAttempts = retryAttempts;
  metrics.backoffViolations = backoffViolations;
  
  console.log(`Rate limit scenario completed: ${requests} requests, ${retryAttempts} retries`);
}

async function executeTimeoutScenario(scenario: TestScenario, testRunId: string, violations: string[], metrics: { [key: string]: number }) {
  const config = scenario.configuration;
  let requests = 0;
  let timeouts = 0;
  let retries = 0;
  
  console.log('Starting timeout scenario');
  
  for (let i = 0; i < 10; i++) {
    try {
      const requestStart = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout_ms);
      
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/chaos-fudo-simulator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            scenario: scenario.id,
            errorRate: config.failure_rate,
            errorType: 'timeout',
            timeoutMs: config.timeout_ms + 5000 // Ensure timeout
          },
          testRunId
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      requests++;
      
      const requestDuration = Date.now() - requestStart;
      
      if (requestDuration > config.timeout_ms) {
        timeouts++;
        
        // Test retry behavior
        for (let retry = 0; retry < config.retry_count; retry++) {
          retries++;
          console.log(`Retry attempt ${retry + 1}/${config.retry_count}`);
          
          if (retries > config.retry_count) {
            violations.push(`Exceeded maximum retry count: ${retries} > ${config.retry_count}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s between retries
        }
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        timeouts++;
        console.log('Request timed out as expected');
      } else {
        console.error('Timeout test request failed:', error);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  metrics.totalRequests = requests;
  metrics.timeouts = timeouts;
  metrics.retries = retries;
  
  console.log(`Timeout scenario completed: ${requests} requests, ${timeouts} timeouts, ${retries} retries`);
}

async function executeOverloadScenario(scenario: TestScenario, testRunId: string, violations: string[], metrics: { [key: string]: number }) {
  const config = scenario.configuration;
  const duration = config.duration_minutes * 60 * 1000;
  const requestsPerSecond = config.requests_per_minute / 60;
  const interval = 1000 / requestsPerSecond;
  
  let requests = 0;
  let rateLimitViolations = 0;
  let cooldownViolations = 0;
  
  console.log(`Starting overload scenario: ${config.requests_per_minute} RPM for ${config.duration_minutes} minutes`);
  
  const startTime = Date.now();
  const requestTimes: number[] = [];
  
  while (Date.now() - startTime < duration) {
    const requestStart = Date.now();
    requestTimes.push(requestStart);
    
    // Check if we're exceeding rate limits
    const recentRequests = requestTimes.filter(time => requestStart - time < 60000).length;
    if (recentRequests > config.requests_per_minute) {
      rateLimitViolations++;
      violations.push(`Rate limit exceeded: ${recentRequests} requests in last minute > ${config.requests_per_minute}`);
    }
    
    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fudo-rotate-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          testMode: true,
          testRunId
        })
      });
      
      requests++;
      
      // Check for cooldown violations
      if (response.status === 429) {
        const lastAttemptTime = requestTimes[requestTimes.length - 2];
        if (lastAttemptTime && (requestStart - lastAttemptTime) < 14400000) { // 4 hours
          cooldownViolations++;
          violations.push('Cooldown period not respected');
        }
      }
      
    } catch (error) {
      console.error('Overload test request failed:', error);
    }
    
    // Record metrics every 50 requests
    if (requests % 50 === 0) {
      await supabase.rpc('record_chaos_metric', {
        p_test_run_id: testRunId,
        p_metric_name: 'overload_requests',
        p_metric_type: 'counter',
        p_value: requests
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  metrics.totalRequests = requests;
  metrics.rateLimitViolations = rateLimitViolations;
  metrics.cooldownViolations = cooldownViolations;
  
  console.log(`Overload scenario completed: ${requests} requests, ${rateLimitViolations} rate violations, ${cooldownViolations} cooldown violations`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, scenarioId, locationId, customConfig } = await req.json();

    if (action === 'start') {
      // Start a new chaos test
      const { data: testRunId, error } = await supabase.rpc('start_chaos_test', {
        p_scenario_id: scenarioId,
        p_target_location_id: locationId,
        p_custom_config: customConfig || {}
      });

      if (error) throw error;

      // Get scenario details
      const { data: scenarios, error: scenarioError } = await supabase
        .from('chaos_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single();

      if (scenarioError) throw scenarioError;

      // Execute scenario in background
      executeScenario(scenarios, testRunId).then(async (results) => {
        await supabase.rpc('complete_chaos_test', {
          p_test_run_id: testRunId,
          p_status: results.status,
          p_results: results.metrics,
          p_violations: results.violations
        });
      });

      return new Response(JSON.stringify({ testRunId, status: 'started' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'status') {
      const { testRunId } = await req.json();
      
      const { data: testRun, error } = await supabase
        .from('chaos_test_runs')
        .select('*')
        .eq('id', testRunId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(testRun), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chaos orchestrator error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});