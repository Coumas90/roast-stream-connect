import { MapPin, Cpu, RotateCcw } from "lucide-react";

const ValueProposition = () => {
  const values = [
    {
      icon: MapPin,
      title: "Origen Trazable",
      description: "Cada lote con coordenadas exactas, altitud y perfil de taza detallado."
    },
    {
      icon: Cpu,
      title: "Tecnología Integrada",
      description: "Dashboard en tiempo real, reposición automática y asesoría personalizada."
    },
    {
      icon: RotateCcw,
      title: "Recurrencia Inteligente",
      description: "Nunca más te quedés sin café. Algoritmo que aprende tu consumo."
    }
  ];

  return (
    <section id="que-es-tupa" className="py-16 lg:py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            No vendemos café.{" "}
            <span className="text-primary">Creamos experiencias.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            TUPÁ es la plataforma que conecta el mundo del café con tecnología inteligente,
            creando una experiencia completa desde el origen hasta tu negocio.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <div key={index} className="text-center space-y-4 p-6 rounded-lg bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <value.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{value.title}</h3>
              <p className="text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;