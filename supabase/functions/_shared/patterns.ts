// Allowlist builder with RegExp support and ENV parsing
export const buildAllowlist = (): (string | RegExp)[] => {
  const fromEnv = (Deno.env.get("CORS_ALLOW_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    // permite pasar regex en ENV como /regex/
    .map(s => (s.startsWith("/") && s.endsWith("/")) ? new RegExp(s.slice(1, -1)) : s);

  return [
    ...fromEnv,
    "http://localhost:5173",
    "http://localhost:3000",
    "https://localhost:5173",
    "https://localhost:3000",
    /https:\/\/preview--.*\.lovable(app|project\.com)$/, // previews de Lovable
    /https:\/\/.*\.lovableproject\.com$/,
    /https:\/\/.*\.supabase\.co$/
  ];
};