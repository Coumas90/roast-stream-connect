import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Política de Privacidad - TUPÁ Hub</title>
        <meta name="description" content="Política de privacidad y protección de datos de TUPÁ Hub" />
      </Helmet>
      
      <Header />
      
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-foreground">Política de Privacidad</h1>
              <p className="text-muted-foreground">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
            </div>

            <div className="prose prose-gray max-w-none space-y-8">
              
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">1. INFORMACIÓN GENERAL</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TUPÁ Hub se compromete a proteger la privacidad de sus usuarios y clientes. Esta 
                  política describe cómo recopilamos, usamos y protegemos su información personal.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">2. INFORMACIÓN QUE RECOPILAMOS</h2>
                <div className="space-y-3 text-muted-foreground">
                  <h3 className="text-lg font-medium text-foreground">2.1 Información Personal</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Nombre completo y datos de contacto</li>
                    <li>Información comercial y financiera</li>
                    <li>Preferencias y patrones de consumo</li>
                    <li>Historial de pedidos y transacciones</li>
                  </ul>

                  <h3 className="text-lg font-medium text-foreground">2.2 Información Técnica</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Datos de uso de plataforma</li>
                    <li>Información de dispositivos</li>
                    <li>Cookies y tecnologías similares</li>
                    <li>Datos de geolocalización (cuando sea autorizado)</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">3. USO DE LA INFORMACIÓN</h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>Utilizamos su información para:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Proveer y mejorar nuestros servicios</li>
                    <li>Procesar pedidos y gestionar cuentas</li>
                    <li>Personalizar experiencias y recomendaciones</li>
                    <li>Comunicaciones comerciales y marketing</li>
                    <li>Análisis de datos y investigación de mercado</li>
                    <li>Cumplir con obligaciones legales</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">4. COMPARTIR INFORMACIÓN</h2>
                <p className="text-muted-foreground leading-relaxed">
                  No vendemos información personal. Podemos compartir datos con proveedores de 
                  servicios, socios comerciales (bajo acuerdos de confidencialidad) y cuando 
                  sea requerido por ley. Los datos agregados y anonimizados pueden ser compartidos 
                  para investigación y desarrollo de la industria.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">5. SEGURIDAD DE DATOS</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Implementamos medidas de seguridad técnicas y organizacionales para proteger 
                  su información contra acceso no autorizado, alteración, divulgación o destrucción.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">6. SUS DERECHOS</h2>
                <div className="space-y-2 text-muted-foreground">
                  <p>Usted tiene derecho a:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Acceder a sus datos personales</li>
                    <li>Rectificar información incorrecta</li>
                    <li>Solicitar la eliminación de datos</li>
                    <li>Oponerse al procesamiento</li>
                    <li>Portabilidad de datos</li>
                    <li>Retirar consentimiento</li>
                  </ul>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">7. CONTACTO</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Para ejercer sus derechos o consultas sobre privacidad:
                  <br />Email: ventas@cafetupa.com
                  <br />Teléfono: +54 9 11 2514-5969
                </p>
              </section>

            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Privacy;