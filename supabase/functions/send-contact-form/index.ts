import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactFormRequest {
  name: string;
  email: string;
  phone: string;
  business: string;
  type: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData: ContactFormRequest = await req.json();

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone || !formData.business || !formData.type) {
      return new Response(
        JSON.stringify({ error: "Todos los campos requeridos deben estar completos" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #8B4513; margin-bottom: 30px; text-align: center; border-bottom: 2px solid #8B4513; padding-bottom: 15px;">
            Nuevo formulario de contacto - TUPÁ
          </h1>
          
          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; margin-bottom: 15px; font-size: 18px;">Información de contacto:</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #666; width: 30%;">Nombre completo:</td>
                <td style="padding: 10px; color: #333;">${formData.name}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #666;">Email:</td>
                <td style="padding: 10px; color: #333;">${formData.email}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #666;">Teléfono:</td>
                <td style="padding: 10px; color: #333;">${formData.phone}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #666;">Nombre del negocio:</td>
                <td style="padding: 10px; color: #333;">${formData.business}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-weight: bold; color: #666;">Tipo de negocio:</td>
                <td style="padding: 10px; color: #333;">${formData.type}</td>
              </tr>
              ${formData.message ? `
              <tr>
                <td style="padding: 10px; font-weight: bold; color: #666; vertical-align: top;">Mensaje:</td>
                <td style="padding: 10px; color: #333;">${formData.message}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 25px;">
            <h3 style="color: #8B4513; margin-bottom: 10px; font-size: 16px;">Próximos pasos:</h3>
            <ul style="color: #666; margin: 0; padding-left: 20px;">
              <li>Contactar al cliente en las próximas 24 horas</li>
              <li>Preparar propuesta personalizada</li>
              <li>Coordinar envío de muestra gratuita</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Email enviado automáticamente desde el formulario de contacto de TUPÁ Hub
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
              ${new Date().toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "TUPÁ Hub <no-reply@resend.dev>",
      to: ["ventas@cafetupa.com"],
      replyTo: formData.email,
      subject: "Formulario TUPA",
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Formulario enviado exitosamente. Te contactaremos pronto." 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-form function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Error al enviar el formulario. Por favor intenta nuevamente." 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);