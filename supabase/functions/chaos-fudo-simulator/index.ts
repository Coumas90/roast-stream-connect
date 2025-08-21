import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChaosConfig {
  scenario: string;
  errorRate: number;
  responseDelay?: number;
  errorType: 'fudo_500' | 'rate_limit_429' | 'timeout';
  timeoutMs?: number;
  retryAfter?: number;
}

interface SimulationMetrics {
  totalRequests: number;
  errorsInjected: number;
  timeoutsInjected: number;
  rateLimit429s: number;
  successfulResponses: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Simulation state
const metrics: SimulationMetrics = {
  totalRequests: 0,
  errorsInjected: 0,
  timeoutsInjected: 0,
  rateLimit429s: 0,
  successfulResponses: 0
};

async function logChaosMetric(testRunId: string, metricName: string, value: number, unit?: string) {
  try {
    await supabase.rpc('record_chaos_metric', {
      p_test_run_id: testRunId,
      p_metric_name: metricName,
      p_metric_type: 'counter',
      p_value: value,
      p_unit: unit || 'count'
    });
  } catch (error) {
    console.error('Failed to log chaos metric:', error);
  }
}

async function simulateFudoError(config: ChaosConfig, testRunId?: string): Promise<Response> {
  metrics.totalRequests++;
  
  const shouldError = Math.random() < config.errorRate;
  
  if (shouldError) {
    switch (config.errorType) {
      case 'fudo_500':
        metrics.errorsInjected++;
        if (testRunId) await logChaosMetric(testRunId, 'fudo_500_injected', 1);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      case 'rate_limit_429':
        metrics.rateLimit429s++;
        if (testRunId) await logChaosMetric(testRunId, 'rate_limit_429_injected', 1);
        const retryAfter = config.retryAfter || Math.floor(Math.random() * 30) + 1;
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString()
          }
        });
        
      case 'timeout':
        metrics.timeoutsInjected++;
        if (testRunId) await logChaosMetric(testRunId, 'timeout_injected', 1);
        // Simulate timeout by delaying response beyond expected timeout
        const timeoutDelay = config.timeoutMs || 35000; // 35s > 30s timeout
        await new Promise(resolve => setTimeout(resolve, timeoutDelay));
        return new Response(JSON.stringify({ error: 'Request timeout' }), {
          status: 408,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  }
  
  // Apply response delay if configured
  if (config.responseDelay && config.responseDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, config.responseDelay));
  }
  
  metrics.successfulResponses++;
  if (testRunId) await logChaosMetric(testRunId, 'successful_response', 1);
  
  // Return successful Fudo API response
  return new Response(JSON.stringify({
    access_token: "mock_chaos_token_" + Date.now(),
    expires_in: 3600,
    token_type: "Bearer"
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.pathname;

    if (endpoint === '/chaos/metrics') {
      return new Response(JSON.stringify(metrics), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (endpoint === '/chaos/reset') {
      Object.keys(metrics).forEach(key => {
        (metrics as any)[key] = 0;
      });
      return new Response(JSON.stringify({ message: 'Metrics reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle chaos simulation requests
    if (req.method === 'POST') {
      const body = await req.json();
      const config: ChaosConfig = body.config;
      const testRunId = body.testRunId;
      
      console.log(`Chaos simulation request - Scenario: ${config.scenario}, Error Rate: ${config.errorRate}`);
      
      return await simulateFudoError(config, testRunId);
    }

    // Default Fudo token endpoint simulation
    if (endpoint.includes('token') && req.method === 'POST') {
      const config: ChaosConfig = {
        scenario: 'default',
        errorRate: 0.1, // 10% error rate by default
        errorType: 'fudo_500'
      };
      
      return await simulateFudoError(config);
    }

    // Default Fudo me endpoint simulation  
    if (endpoint.includes('me') && req.method === 'GET') {
      return new Response(JSON.stringify({
        user: {
          id: "chaos_user_123",
          email: "chaos@test.com",
          name: "Chaos Test User"
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chaos simulator error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});