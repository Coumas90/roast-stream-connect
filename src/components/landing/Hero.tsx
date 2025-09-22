import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, Zap } from "lucide-react";

const Hero = () => {
  return (
    <section className="pt-24 pb-12 lg:pt-32 lg:pb-16 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                El café que{" "}
                <span className="text-primary">transforma</span>{" "}
                tu negocio
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Conectamos tostadores y cafeterías con tecnología inteligente. 
                Desde el origen hasta la taza perfecta, gestionamos tu stock, 
                optimizamos tu consumo y garantizamos la calidad.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <a href="#cta">Prueba TUPÁ Gratis</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#catalogo">Ver Catálogo</a>
              </Button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="flex items-center gap-2 py-2 px-4">
                <Star className="h-4 w-4 text-yellow-500" />
                98% Satisfacción
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2 py-2 px-4">
                <Shield className="h-4 w-4 text-green-500" />
                100% Trazable
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-2 py-2 px-4">
                <Zap className="h-4 w-4 text-blue-500" />
                IA Integrada
              </Badge>
            </div>
          </div>

          {/* Right Image */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl"></div>
              <img
                src="/assets/colombia.png"
                alt="Personaje representativo del café colombiano"
                className="relative w-96 h-96 lg:w-[500px] lg:h-[500px] object-contain drop-shadow-2xl filter brightness-110 contrast-110"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;