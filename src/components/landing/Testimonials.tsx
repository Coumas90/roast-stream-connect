import { Card, CardContent } from "@/components/ui/card";

const Testimonials = () => {
  const testimonials = [
    {
      quote: "TUPÁ transformó completamente la experiencia de café en nuestro local. Nuestros clientes notan la diferencia y el café de calidad superior nos ayudó a diferenciarnos en el mercado.",
      name: "Dani",
      role: "Gerente - Togni Café"
    },
    {
      quote: "La calidad del café TUPÁ elevó el nivel de nuestro restaurante. Los productos de origen trazable y el soporte técnico nos permitieron crear una experiencia gastronómica única.",
      name: "Vanesa",
      role: "Dueña - Chef León"
    },
    {
      quote: "Como centro de formación, necesitábamos café de la más alta calidad para nuestros cursos. TUPÁ no solo cumplió nuestras expectativas, sino que superó todos los estándares profesionales.",
      name: "Ariel Pereyra",
      role: "Dueño - Centro Argentino de Barismo (CAB)"
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