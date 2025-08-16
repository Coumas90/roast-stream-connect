// Bulletproof CORS helper with origin allowlist and RegExp support
export interface CorsConfig {
  allowlist: (string | RegExp)[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const isAllowed = (origin: string, list: (string | RegExp)[]): boolean =>
  list.some(e => typeof e === "string" ? e === origin : e.test(origin));

const addVary = (h: Headers, v: string): void =>
  h.set("Vary", h.get("Vary") ? `${h.get("Vary")}, ${v}` : v);

export const withCORS = (
  handler: (req: Request) => Promise<Response> | Response,
  opts: CorsConfig
) => async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") ?? "";
  const isBrowser = Boolean(origin);
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") ?? "";
  const reqMethod = req.headers.get("Access-Control-Request-Method") ?? "";

  // Preflight
  if (req.method === "OPTIONS") {
    const res = new Response(null, { status: 204 });
    const h = res.headers;
    addVary(h, "Origin");
    addVary(h, "Access-Control-Request-Method");
    addVary(h, "Access-Control-Request-Headers");

    if (!origin || !isAllowed(origin, opts.allowlist)) return res; // sin headers CORS

    h.set("Access-Control-Allow-Origin", origin);
    if (opts.credentials) h.set("Access-Control-Allow-Credentials", "true");
    h.set("Access-Control-Allow-Methods", (opts.allowMethods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]).join(", "));
    h.set("Access-Control-Allow-Headers", (opts.allowHeaders ?? reqHeaders || "authorization,content-type,x-request-id").toString());
    if (opts.maxAge) h.set("Access-Control-Max-Age", String(opts.maxAge));
    return res;
  }

  // Request normal
  if (isBrowser && origin && !isAllowed(origin, opts.allowlist)) {
    console.warn(`CORS: Origin blocked: ${origin}`);
    return new Response("CORS origin not allowed", { status: 403 });
  }

  const res = await handler(req);
  const h = new Headers(res.headers);

  if (origin && isAllowed(origin, opts.allowlist)) {
    addVary(h, "Origin");
    h.set("Access-Control-Allow-Origin", origin); // nunca "*"
    if (opts.credentials) h.set("Access-Control-Allow-Credentials", "true");
    if (opts.exposeHeaders?.length) {
      h.set("Access-Control-Expose-Headers", opts.exposeHeaders.join(", "));
    }
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

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