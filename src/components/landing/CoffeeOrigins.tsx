const CoffeeOrigins = () => {
  const origins = [
    {
      name: "Colombia",
      image: "/assets/colombia.png",
      description: "Montañas de los Andes, suelos volcánicos"
    },
    {
      name: "Colombia Bruselas",
      image: "/assets/colombia-bruselas.png",
      description: "Región de Huila, proceso especial"
    },
    {
      name: "Guatemala",
      image: "/assets/guatemala.png",
      description: "Tierras altas, tradición ancestral"
    },
    {
      name: "Brasil",
      image: "/assets/brasil.png",
      description: "Cerrado, tecnología y sostenibilidad"
    },
    {
      name: "Blend Especial",
      image: "/assets/blend.png",
      description: "Mezcla perfecta de nuestros mejores orígenes"
    }
  ];

  return (
    <section id="origenes" className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Cada café tiene su{" "}
            <span className="text-primary">propia historia</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Trabajamos directamente con productores de América Latina para traerte 
            los mejores granos con total trazabilidad y comercio justo.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {origins.map((origin, index) => (
            <div key={index} className="text-center space-y-4 group cursor-pointer">
              <div className="relative overflow-hidden rounded-2xl bg-muted/30 p-6 group-hover:bg-muted/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <img
                  src={origin.image}
                  alt={`Café de ${origin.name}`}
                  className="w-full h-32 object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">{origin.name}</h3>
                <p className="text-sm text-muted-foreground">{origin.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoffeeOrigins;