import { Card, CardContent } from "@/components/ui/card";

const Testimonials = () => {
  const testimonials = [
    {
      quote: "Nuestros clientes notan la diferencia. El café TUPÁ elevó completamente la experiencia en nuestro local.",
      name: "María González",
      role: "Dueña de Café Central"
    },
    {
      quote: "El café TUPÁ transformó el ambiente de oficina. Los reportes de consumo nos ayudan a entender mejor las preferencias del equipo y la productividad aumentó notablemente.",
      name: "Carlos Méndez",
      role: "Gerente de HR - Tech Corp"
    },
    {
      quote: "Los maridajes que nos sugirieron transformaron nuestro menú de postres. Café de autor, literal.",
      name: "Ana Herrera",
      role: "Chef Ejecutiva"
    }
  ];

  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Testimonios Reales<br />
            Nuestros clientes{" "}
            <span className="text-primary">hablan por nosotros</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300">
              <CardContent className="p-8 space-y-6">
                <p className="text-muted-foreground italic leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;