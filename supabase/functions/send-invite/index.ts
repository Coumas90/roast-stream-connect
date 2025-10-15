
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
  role?: string | null;
  locationName?: string | null;
  inviterName?: string | null;
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

    const { to, inviteUrl, tenantName, role, locationName, inviterName }: SendInvitePayload = await req.json();
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

    const roleLabels: Record<string, string> = {
      owner: "Propietario",
      manager: "Gerente", 
      coffee_master: "Coffee Master",
      barista: "Barista",
    };

    const brand = tenantName ? `${tenantName} — TUPÁ Hub` : "TUPÁ Hub";
    const subject = tenantName ? `Invitación a ${tenantName} · TUPÁ Hub` : "Invitación a TUPÁ Hub";
    const roleDisplay = role ? roleLabels[role] || role : "miembro del equipo";
    const locationText = locationName ? ` en la sucursal <strong>${locationName}</strong>` : "";
    const inviterText = inviterName ? `<p style="margin:16px 0;">${inviterName} te ha invitado a unirte al equipo.</p>` : "";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; max-width:600px; margin:0 auto; padding:20px; color:#0f172a;">
        
        <!-- Header -->
        <div style="text-align:center; margin-bottom:32px;">
          <h1 style="margin:0 0 8px; font-size:28px; font-weight:700; color:#111827;">¡Bienvenido/a a TUPÁ Hub! 🎉</h1>
          <p style="margin:0; color:#64748b; font-size:16px;">Tu invitación para unirte a ${brand}</p>
        </div>

        <!-- Invitation Card -->
        <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:24px; margin-bottom:24px;">
          ${inviterText}
          
          <p style="margin:0 0 20px; font-size:15px; line-height:1.6;">
            Has sido invitado/a como <strong style="color:#111827;">${roleDisplay}</strong>${locationText}.
          </p>

          <!-- Benefits -->
          <div style="background:#f8fafc; border-radius:8px; padding:16px; margin:20px 0;">
            <p style="margin:0 0 12px; font-weight:600; font-size:14px; color:#111827;">✨ Tendrás acceso a:</p>
            <ul style="margin:0; padding-left:20px; font-size:14px; color:#475569; line-height:1.8;">
              <li>Sistema profesional de calibración de café</li>
              <li>Gestión de inventario en tiempo real</li>
              <li>Herramientas de formación y capacitación</li>
              <li>Panel de métricas y analytics</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center; margin:28px 0;">
            <a href="${inviteUrl}" target="_blank" style="display:inline-block; background:#111827; color:#ffffff; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:16px;">
              Aceptar invitación →
            </a>
          </div>

          <p style="margin:20px 0 0; font-size:13px; color:#64748b; text-align:center;">
            Si el botón no funciona, copia y pega este enlace:<br/>
            <a href="${inviteUrl}" target="_blank" style="color:#3b82f6; word-break:break-all;">${inviteUrl}</a>
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align:center; padding-top:20px; border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; font-size:13px; color:#64748b;">
            ⏱️ Esta invitación expira en 7 días
          </p>
          <p style="margin:0; font-size:12px; color:#94a3b8;">
            Si no solicitaste esta invitación, puedes ignorar este correo.
          </p>
        </div>
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
