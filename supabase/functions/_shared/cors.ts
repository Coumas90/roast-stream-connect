// Secure CORS helper with origin allowlist
// Usage: import { createCorsHandler } from "../_shared/cors.ts";

export interface CorsConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  allowedHeaders?: string[];
  allowedMethods?: string[];
  maxAge?: number;
}

const DEFAULT_CONFIG: Required<CorsConfig> = {
  allowedOrigins: [],
  allowCredentials: true,
  allowedHeaders: [
    "authorization",
    "x-client-info", 
    "apikey",
    "content-type",
    "x-job-token",
    "x-api-key"
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  maxAge: 86400, // 24 hours
};

function parseAllowedOrigins(): string[] {
  const envOrigins = (globalThis as any)?.Deno?.env?.get?.("ALLOWED_ORIGINS");
  if (!envOrigins) {
    // Fallback to fixed list for development/staging
    return [
      "http://localhost:5173",
      "http://localhost:3000", 
      "https://localhost:5173",
      "https://localhost:3000",
      "https://*.lovableproject.com",
      "https://*.supabase.co"
    ];
  }
  
  return envOrigins.split(",").map((origin: string) => origin.trim()).filter(Boolean);
}

function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // Exact match first
  if (allowedOrigins.includes(origin)) return true;
  
  // Wildcard subdomain matching (e.g., "*.example.com")
  return allowedOrigins.some(allowed => {
    if (allowed.includes("*")) {
      const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(origin);
    }
    return false;
  });
}

export function createCorsHandler(config: CorsConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const allowedOrigins = finalConfig.allowedOrigins.length > 0 
    ? finalConfig.allowedOrigins 
    : parseAllowedOrigins();

  return {
    // Handle OPTIONS preflight requests
    handlePreflight: (req: Request): Response => {
      const origin = req.headers.get("Origin");
      const requestMethod = req.headers.get("Access-Control-Request-Method");
      const requestHeaders = req.headers.get("Access-Control-Request-Headers");

      if (!isOriginAllowed(origin, allowedOrigins)) {
        console.warn(`CORS: Origin blocked: ${origin}`);
        return new Response("Forbidden", { 
          status: 403,
          headers: { "Content-Type": "text/plain" }
        });
      }

      const headers: Record<string, string> = {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": finalConfig.allowedMethods.join(", "),
        "Access-Control-Allow-Headers": finalConfig.allowedHeaders.join(", "),
        "Access-Control-Max-Age": finalConfig.maxAge.toString(),
        "Vary": "Origin",
      };

      if (finalConfig.allowCredentials) {
        headers["Access-Control-Allow-Credentials"] = "true";
      }

      // Validate requested method and headers
      if (requestMethod && !finalConfig.allowedMethods.includes(requestMethod)) {
        return new Response("Method not allowed", { status: 405 });
      }

      if (requestHeaders) {
        const requested = requestHeaders.split(",").map(h => h.trim().toLowerCase());
        const allowed = finalConfig.allowedHeaders.map(h => h.toLowerCase());
        const hasDisallowed = requested.some(h => !allowed.includes(h));
        if (hasDisallowed) {
          return new Response("Headers not allowed", { status: 400 });
        }
      }

      return new Response(null, { status: 204, headers });
    },

    // Get CORS headers for actual responses
    getHeaders: (req: Request): Record<string, string> => {
      const origin = req.headers.get("Origin");
      
      if (!isOriginAllowed(origin, allowedOrigins)) {
        console.warn(`CORS: Origin blocked in response: ${origin}`);
        return { "Vary": "Origin" }; // Still include Vary header
      }

      const headers: Record<string, string> = {
        "Access-Control-Allow-Origin": origin || "*",
        "Vary": "Origin",
      };

      if (finalConfig.allowCredentials) {
        headers["Access-Control-Allow-Credentials"] = "true";
      }

      return headers;
    },

    // Convenience method to create JSON responses with CORS
    jsonResponse: (req: Request, data: unknown, init: ResponseInit = {}): Response => {
      const corsHeaders = this.getHeaders(req);
      const headers = {
        ...corsHeaders,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      };

      return new Response(JSON.stringify(data), {
        ...init,
        headers,
      });
    }
  };
}

// Enhanced auth checker for orchestration endpoints
export function requireSecureAuth(req: Request, validTokens: string[]): { ok: boolean; error?: string } {
  // Check for job token in headers
  const jobToken = req.headers.get("X-Job-Token") || req.headers.get("x-job-token");
  if (jobToken && validTokens.includes(jobToken)) {
    return { ok: true };
  }

  // Check for API key in headers  
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
  if (apiKey && validTokens.includes(apiKey)) {
    return { ok: true };
  }

  // Check Authorization header
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or invalid authorization header" };
  }

  return { ok: true }; // JWT validation delegated to Supabase
}