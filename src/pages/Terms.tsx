import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Términos y Condiciones - TUPÁ Hub</title>
        <meta name="description" content="Términos y condiciones de uso de los servicios de TUPÁ Hub" />
      </Helmet>
      
      <Header />
      
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-foreground">Términos y Condiciones</h1>
              <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
            </div>

            <div className="prose prose-gray max-w-none space-y-8">
              
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">1. ACEPTACIÓN DE LOS TÉRMINOS</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Al acceder y utilizar los servicios de TUPÁ Hub (en adelante "TUPÁ", "nosotros", "nuestro"), 
                  usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguno 
                  de estos términos, no debe utilizar nuestros servicios.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">2. DEFINICIONES</h2>
                <div className="space-y-2 text-muted-foreground">
                  <p><strong>"Cliente Directo":</strong> Cafeterías, restaurantes, oficinas u otros establecimientos que contratan directamente nuestros servicios.</p>
                  <p><strong>"Usuario Final":</strong> Consumidores que utilizan café TUPÁ en establecimientos de nuestros Clientes Directos.</p>
                  <p><strong>"Servicios":</strong> Suministro de café, tecnología, plataforma digital, capacitación y soporte técnico.</p>
                  <p><strong>"Datos":</strong> Toda información recopilada a través de nuestros servicios y plataformas.</p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">3. SERVICIOS OFRECIDOS</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TUPÁ proporciona café de especialidad, tecnología de gestión, plataforma digital de monitoreo, 
                  capacitación de baristas, soporte técnico y servicios de consultoría relacionados con la 
                  experiencia del café.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">4. RECOPILACIÓN Y USO DE DATOS</h2>
                <div className="space-y-3 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">4.1 Datos de Clientes Directos</h3>
                  <p>Recopilamos información de nuestros Clientes Directos incluyendo pero no limitado a:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Datos de contacto (nombre, email, teléfono, dirección)</li>
                    <li>Información comercial y financiera</li>
                    <li>Patrones de consumo y preferencias de café</li>
                    <li>Datos de uso de la plataforma digital</li>
                    <li>Feedback y evaluaciones de productos/servicios</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">4.2 Datos de Usuarios Finales</h3>
                  <p>A través de nuestros Clientes Directos y tecnología integrada, podemos recopilar:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Patrones de consumo de café</li>
                    <li>Preferencias de productos</li>
                    <li>Horarios y frecuencia de consumo</li>
                    <li>Feedback sobre calidad y satisfacción</li>
                    <li>Datos demográficos agregados</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">4.3 Propósitos del Uso de Datos</h3>
                  <p>Los datos recopilados serán utilizados para:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Mejorar la calidad de productos y servicios</li>
                    <li>Personalizar recomendaciones y ofertas</li>
                    <li>Desarrollar campañas de marketing dirigidas</li>
                    <li>Realizar análisis de mercado y tendencias</li>
                    <li>Optimizar operaciones y logística</li>
                    <li>Enviar comunicaciones comerciales y promocionales</li>
                    <li>Investigación y desarrollo de nuevos productos</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">5. CONSENTIMIENTO PARA MARKETING</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Al aceptar estos términos, usted consiente expresamente que TUPÁ utilice sus datos 
                  personales y comerciales para actividades de marketing directo, incluyendo pero no 
                  limitado a: envío de newsletters, promociones, lanzamientos de productos, invitaciones 
                  a eventos y estudios de mercado. Este consentimiento se extiende a comunicaciones 
                  por email, teléfono, WhatsApp y otros medios digitales.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">6. COMPARTIR DATOS CON TERCEROS</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TUPÁ se reserva el derecho de compartir datos agregados y anonimizados con socios 
                  comerciales, proveedores de tecnología y entidades de investigación para mejorar 
                  la industria del café. Los datos personales identificables solo se compartirán 
                  con proveedores de servicios necesarios para nuestras operaciones, bajo estrictos 
                  acuerdos de confidencialidad.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">7. OBLIGACIONES DEL CLIENTE</h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>Los Clientes Directos se comprometen a:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Informar a sus usuarios finales sobre la recopilación de datos por parte de TUPÁ</li>
                    <li>Obtener consentimientos necesarios cuando sea requerido por ley</li>
                    <li>Usar los productos y servicios de manera responsable</li>
                    <li>Proporcionar información veraz y actualizada</li>
                    <li>Cumplir con los estándares de calidad en la preparación del café</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">8. LIMITACIÓN DE RESPONSABILIDAD</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TUPÁ no será responsable por daños indirectos, incidentales, especiales o 
                  consecuenciales derivados del uso de nuestros servicios. Nuestra responsabilidad 
                  total no excederá el monto pagado por los servicios en los últimos 12 meses.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">9. PROPIEDAD INTELECTUAL</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Todos los derechos de propiedad intelectual relacionados con TUPÁ, incluyendo 
                  marcas, logos, tecnología, software y contenido, son propiedad exclusiva de TUPÁ 
                  o sus licenciantes. Queda prohibida su reproducción sin autorización expresa.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">10. TERMINACIÓN</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Cualquier parte puede terminar el acuerdo de servicios con aviso previo de 30 días. 
                  TUPÁ se reserva el derecho de suspender servicios inmediatamente en caso de 
                  incumplimiento de estos términos. Los datos recopilados pueden ser retenidos 
                  según nuestras políticas de retención de datos.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">11. MODIFICACIONES</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TUPÁ se reserva el derecho de modificar estos términos en cualquier momento. 
                  Las modificaciones entrarán en vigor al ser publicadas en nuestro sitio web. 
                  El uso continuado de nuestros servicios constituye aceptación de los términos modificados.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">12. LEY APLICABLE Y JURISDICCIÓN</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa 
                  será sometida a la jurisdicción exclusiva de los tribunales de Capital Federal, Argentina.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">13. CONTACTO</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para consultas sobre estos términos, contáctenos en:
                  <br />Email: ventas@cafetupa.com
                  <br />Teléfono: +54 9 11 2514-5969
                  <br />Dirección: Capital Federal, Argentina
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">14. DERECHOS DEL CONSUMIDOR</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Los consumidores tienen derecho a acceder, rectificar, cancelar u oponerse al 
                  tratamiento de sus datos personales según la Ley de Protección de Datos Personales 
                  de Argentina. Para ejercer estos derechos, contactar a ventas@cafetupa.com.
                </p>
              </section>

              <div className="mt-12 p-6 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Al utilizar los servicios de TUPÁ Hub, usted reconoce que ha leído, entendido y 
                  acepta estar sujeto a estos Términos y Condiciones en su totalidad.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Terms;