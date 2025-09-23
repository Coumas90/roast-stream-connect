import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Shield, Zap } from "lucide-react";

const Technology = () => {
  const benefits = [
    {
      icon: BarChart3,
      title: "Dashboard de consumo en tiempo real",
      description: "Monitoreo continuo de patrones de uso"
    },
    {
      icon: TrendingUp,
      title: "Predicción inteligente de reposición",
      description: "Algoritmo que prevé tus necesidades"
    },
    {
      icon: Shield,
      title: "Asesoría personalizada por barista experto",
      description: "Soporte especializado cuando lo necesites"
    },
    {
      icon: Zap,
      title: "Reportes de calidad y satisfacción",
      description: "Análisis completo de rendimiento"
    }
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Café Central",
      quote: "Reducimos el desperdicio en un 30% desde que usamos TUPÁ"
    },
    {
      name: "Carlos Mendoza",
      role: "Coffee & Co",
      quote: "La reposición automática me ahorra 10 horas semanales"
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
                TUPÁ Hub<br />
                Tecnología que{" "}
                <span className="text-primary">simplifica.</span>{" "}
                Datos que{" "}
                <span className="text-primary">potencian.</span>
              </h2>
              <p className="text-xl text-muted-foreground">
                Nuestra plataforma integrada te da control total: monitoreo de consumo, 
                reposición automática, insights de rendimiento y asesoría en tiempo real.
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