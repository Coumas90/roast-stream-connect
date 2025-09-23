import { Coffee, Building2, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BusinessSegments = () => {
  const segments = [
    {
      icon: Coffee,
      title: "Cafeterías",
      description: "Diferenciá tu propuesta",
      features: [
        "Mezclas exclusivas para tu marca",
        "Fichas técnicas para tu equipo",
        "Reposición automática",
        "Capacitación incluida"
      ]
    },
    {
      icon: Building2,
      title: "Oficinas",
      description: "Café premium que impulsa la productividad",
      features: [
        "Dashboard de consumo y métricas de equipo",
        "Variedad rotativa mensual con perfiles únicos",
        "Setup completo: máquinas + capacitación",
        "Reposición automática sin interrupciones",
        "Servicio técnico incluido 24/7",
        "Reportes de satisfacción y uso",
        "Blends energizantes para diferentes momentos",
        "Opciones descafeinadas y alternativas plant-based"
      ]
    },
    {
      icon: UtensilsCrossed,
      title: "Restaurantes",
      description: "Complementá tu carta",
      features: [
        "Blends diseñados para tu cocina",
        "Café de sobremesa excepcional",
        "Presentación premium",
        "Asesoría en maridajes"
      ]
    }
  ];

  return (
    <section id="segmentos" className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Soluciones por Segmento<br />
            Tu negocio es único.{" "}
            <span className="text-primary">Tu café también.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {segments.map((segment, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-0 bg-background/50 backdrop-blur-sm">
              <CardHeader className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                  <segment.icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">{segment.title}</CardTitle>
                <p className="text-muted-foreground">{segment.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {segment.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BusinessSegments;