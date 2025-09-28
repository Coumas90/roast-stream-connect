import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Shield, Zap } from "lucide-react";

const Technology = () => {
  const benefits = [
    {
      icon: Shield,
      title: "Soporte personalizado 24/7",
      description: "Asistencia experta cuando la necesites"
    },
    {
      icon: Zap,
      title: "Capacitación y entrenamiento continuo",
      description: "Formación constante para tu equipo"
    },
    {
      icon: BarChart3,
      title: "Seguimiento post-venta",
      description: "Monitoreo de satisfacción y calidad"
    },
    {
      icon: TrendingUp,
      title: "Asesoría especializada en café",
      description: "Consultoría de baristas certificados"
    }
  ];

  const testimonials = [
    {
      name: "Dani",
      role: "Togni Café",
      quote: "El soporte técnico y la capacitación continua nos ayudó a maximizar nuestro café"
    },
    {
      name: "Vanesa",
      role: "Chef León",
      quote: "La asesoría personalizada transformó como servimos café en nuestro restaurante"
    }
  ];

  return (
    <section id="tecnologia" className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
                Servicio postventa{" "}
                <span className="text-primary">excepcional.</span><br />
                Soporte que{" "}
                <span className="text-primary">marca la diferencia.</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Nuestro compromiso va más allá de la entrega. Te acompañamos con 
                capacitación continua, soporte técnico 24/7 y asesoría personalizada para 
                maximizar tu experiencia de café.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-background/50">
                  <benefit.icon className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{benefit.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonials */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Lo que dicen nuestros clientes:</h3>
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="border-0 bg-background/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground italic mb-2">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{testimonial.name}</span>
                      <Badge variant="secondary" className="text-xs">{testimonial.role}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Right - Dashboard Mockup */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-2xl"></div>
            <Card className="relative border-0 bg-background/80 backdrop-blur-sm shadow-2xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">Dashboard TUPÁ</h4>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">En Vivo</Badge>
                  </div>
                  
                  {/* Mock Chart */}
                  <div className="h-32 bg-muted/30 rounded-lg flex items-end justify-center gap-2 p-4">
                    <div className="w-8 bg-primary/60 rounded-t" style={{height: '60%'}}></div>
                    <div className="w-8 bg-primary/70 rounded-t" style={{height: '80%'}}></div>
                    <div className="w-8 bg-primary rounded-t" style={{height: '100%'}}></div>
                    <div className="w-8 bg-primary/80 rounded-t" style={{height: '75%'}}></div>
                    <div className="w-8 bg-primary/50 rounded-t" style={{height: '45%'}}></div>
                  </div>

                  {/* Mock Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Consumo Semanal</p>
                      <p className="text-lg font-bold text-foreground">+12%</p>
                      <p className="text-xs text-green-600">Tendencia positiva</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Próxima entrega</p>
                      <p className="text-lg font-bold text-foreground">En 3 días</p>
                      <p className="text-xs text-muted-foreground">Stock actual: 2.5 kg</p>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button variant="outline" size="sm" className="w-full">
                      Ver Demo de la Plataforma
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Technology;