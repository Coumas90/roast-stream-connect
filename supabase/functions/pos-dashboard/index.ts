import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0'

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
  expirations: any[];
  mttr_details: any[];
  breaker_status: any[];
  timestamp: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get dashboard summary
    const { data: summaryData, error: summaryError } = await supabaseClient
      .rpc('get_pos_dashboard_summary');

    if (summaryError) {
      console.error('Error fetching dashboard summary:', summaryError);
      throw summaryError;
    }

    // Get upcoming expirations (top 20)
    const { data: expirations, error: expirationsError } = await supabaseClient
      .from('pos_dashboard_expirations')
      .select('*')
      .order('expires_at', { ascending: true })
      .limit(20);

    if (expirationsError) {
      console.error('Error fetching expirations:', expirationsError);
      throw expirationsError;
    }

    // Get MTTR details by location/provider
    const { data: mttrData, error: mttrError } = await supabaseClient
      .rpc('calculate_pos_mttr_7d');

    if (mttrError) {
      console.error('Error calculating MTTR:', mttrError);
      throw mttrError;
    }

    // Get circuit breaker status
    const { data: breakers, error: breakersError } = await supabaseClient
      .from('pos_dashboard_breakers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (breakersError) {
      console.error('Error fetching breaker status:', breakersError);
      throw breakersError;
    }

    const dashboardData: DashboardData = {
      summary: summaryData.summary,
      expirations: expirations || [],
      mttr_details: mttrData || [],
      breaker_status: breakers || [],
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(dashboardData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in pos-dashboard function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});