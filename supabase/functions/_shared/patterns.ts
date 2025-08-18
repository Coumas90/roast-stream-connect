// Allowlist builder with RegExp support and ENV parsing
export const buildAllowlist = (): (string | RegExp)[] => {
  const fromEnv = (Deno.env.get("CORS_ALLOW_ORIGINS") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    // permite pasar regex en ENV como /regex/ con try/catch
    .map(s => {
      if (s.startsWith("/") && s.endsWith("/")) {
        try {
          return new RegExp(s.slice(1, -1));
        } catch (e) {
          console.warn(`CORS: Invalid regex in ENV: ${s} - ${e.message}`);
          return s; // fallback a string
        }
      }
      return s;
    });

  return [
    ...fromEnv,
    "http://localhost:5173",
    "http://localhost:3000",
    "https://localhost:5173",
    "https://localhost:3000",
    /^https:\/\/preview--.*\.(lovable\.app|lovableproject\.com)$/, // previews de Lovable
    /^https:\/\/.*\.lovableproject\.com$/,
    /^https:\/\/.*\.supabase\.co$/
  ];
};