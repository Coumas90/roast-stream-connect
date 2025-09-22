import { Package, Beaker, GraduationCap } from "lucide-react";

const Products = () => {
  const products = [
    {
      icon: Package,
      title: "Café Premium",
      description: "Granos seleccionados de origen único y blends especiales con trazabilidad completa y notas de cata detalladas."
    },
    {
      icon: Beaker,
      title: "Tecnología Smart",
      description: "Plataforma integral con IA para gestión de stock, análisis de consumo y reposición automática predictiva."
    },
    {
      icon: GraduationCap,
      title: "TUPÁ Academy",
      description: "Formación continua para tu equipo con cursos de barismo, cata y gestión del café en modalidad virtual y presencial."
    }
  ];

  return (
    <section id="catalogo" className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Desde el grano hasta{" "}
            <span className="text-primary">la taza perfecta</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Una solución completa que combina café de especialidad, tecnología avanzada 
            y formación especializada para transformar tu experiencia cafetera.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div key={index} className="text-center space-y-6 p-8 rounded-2xl bg-gradient-to-br from-background to-muted/30 hover:shadow-lg transition-all duration-300">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <product.icon className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold text-foreground">{product.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Products;