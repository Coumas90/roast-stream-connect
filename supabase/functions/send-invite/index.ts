
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { withCORS } from "../_shared/cors.ts";
import { buildAllowlist } from "../_shared/patterns.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const FROM_DEFAULT = "Lovable <onboarding@resend.dev>";
const FROM_CONFIG = Deno.env.get("RESEND_FROM") || FROM_DEFAULT;

// Comma-separated list of allowed origins (e.g., https://app.example.com,https://staging.example.com)
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);


// Simple in-memory rate limiter per (origin + email)
type RateEntry = { count: number; first: number };
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX = 5;
const rateMap = new Map<string, RateEntry>();

function isAllowedOrigin(origin: string | null): boolean {
  if (!ALLOWED_ORIGINS.length) return true; // if not configured, allow all
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function rateKey(origin: string | null, email: string): string {
  return `${origin ?? "no-origin"}::${email.toLowerCase()}`;
}

function isRateLimited(origin: string | null, email: string): boolean {
  const key = rateKey(origin, email);
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry) {
    rateMap.set(key, { count: 1, first: now });
    return false;
  }
  // Reset window if elapsed
  if (now - entry.first > RATE_WINDOW_MS) {
    rateMap.set(key, { count: 1, first: now });
    return false;
  }
  if (entry.count >= RATE_MAX) return true;
  entry.count += 1;
  return false;
}

interface SendInvitePayload {
  to: string;
  inviteUrl: string;
  tenantName?: string | null;
}

serve(withCORS(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin");
    if (!isAllowedOrigin(origin)) {
      console.warn("send-invite: blocked origin", origin);
      return new Response(JSON.stringify({ error: "Forbidden origin" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { to, inviteUrl, tenantName }: SendInvitePayload = await req.json();
    if (!to || !inviteUrl) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'inviteUrl'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (isRateLimited(origin, to)) {
      console.warn("send-invite: rate limited", { origin, to });
      return new Response(JSON.stringify({ error: "Too many requests, try later" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const brand = tenantName ? `${tenantName} — TUPÁ Hub` : "TUPÁ Hub";
    const subject = tenantName ? `Invitación a ${tenantName} · TUPÁ Hub` : "Invitación a TUPÁ Hub";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height:1.6; color:#0f172a;">
        <h2 style="margin:0 0 12px;">Invitación a ${brand}</h2>
        <p>Has sido invitado/a a unirte. Haz clic en el botón para aceptar la invitación:</p>
        <p>
          <a href="${inviteUrl}" target="_blank" style="display:inline-block; background:#111827; color:#ffffff; padding:10px 16px; border-radius:8px; text-decoration:none;">Aceptar invitación</a>
        </p>
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${inviteUrl}" target="_blank">${inviteUrl}</a></p>
        <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;" />
        <p style="font-size:12px; color:#64748b;">Este enlace expira en 7 días.</p>
      </div>
    `;

    console.log("send-invite: sending", { to, origin, tenantName });

    const { error } = await resend.emails.send({
      from: FROM_CONFIG,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("send-invite: Resend error", error);
      return new Response(JSON.stringify({ error: error.message ?? String(error) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-invite: Unexpected error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, {
  allowlist: buildAllowlist(),
  credentials: false,
  maxAge: 86400,
  allowHeaders: ["authorization", "content-type", "x-client-info", "apikey"]
}));
