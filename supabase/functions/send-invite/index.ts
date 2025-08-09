import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvitePayload {
  to: string;
  inviteUrl: string;
  tenantName?: string | null;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { to, inviteUrl, tenantName }: SendInvitePayload = await req.json();

    if (!to || !inviteUrl) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'inviteUrl'" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const brand = tenantName ? `${tenantName} — TUPÁ Hub` : "TUPÁ Hub";

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

    const subject = tenantName ? `Invitación a ${tenantName} · TUPÁ Hub` : "Invitación a TUPÁ Hub";

    const { error } = await resend.emails.send({
      from: "Lovable <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("send-invite: Resend error", error);
      return new Response(JSON.stringify({ error: error.message ?? String(error) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("send-invite: Unexpected error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
