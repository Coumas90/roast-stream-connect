import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, apiKey } = await req.json();

    // Stub temporal: validar formato básico y devolver válido
    const valid = typeof apiKey === "string" && apiKey.trim().length > 0 && typeof provider === "string";

    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("validate-credentials error", error);
    return new Response(JSON.stringify({ valid: false, error: "Invalid payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
