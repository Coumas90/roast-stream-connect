import { Package, Beaker, GraduationCap } from "lucide-react";

const Products = () => {
  const products = [
    {
      icon: Package,
      title: "Granos de Origen",
      description: "Monoorígenes trazables de fincas seleccionadas. Fichas técnicas completas incluidas.",
      features: ["• Tostado a pedido", "• Empaque con válvula desgasificante", "• Coordenadas GPS de origen"]
    },
    {
      icon: Beaker,
      title: "Blends Exclusivos",
      description: "Mezclas diseñadas para tu perfil de negocio. Fórmulas únicas que no encontrarás en otro lado.",
      features: ["• Desarrollados por Q-graders", "• Consistencia garantizada", "• Personalización de marca"]
    },
    {
      icon: GraduationCap,
      title: "Equipos y Accesorios",
      description: "Todo lo que necesitás para extraer el máximo potencial del café. Setup completo incluido.",
      features: ["• Molinos calibrados", "• Máquinas de espresso", "• Capacitación técnica"]
    }
  ];

  return (
    <section id="catalogo" className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Catálogo Premium<br />
            Desde el grano hasta{" "}
            <span className="text-primary">la taza perfecta</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div key={index} className="text-left space-y-6 p-8 rounded-2xl bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <product.icon className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-foreground">{product.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
                <div className="space-y-1">
                  {product.features.map((feature, featureIndex) => (
                    <p key={featureIndex} className="text-sm text-muted-foreground">{feature}</p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Products;