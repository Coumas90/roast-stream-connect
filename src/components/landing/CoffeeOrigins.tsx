const CoffeeOrigins = () => {
  const origins = [
    {
      name: "Colombia Huila",
      image: "/assets/colombia.png",
      description: "Cítrico, Chocolate",
      altitude: "1,800m"
    },
    {
      name: "Guatemala Antigua",
      image: "/assets/guatemala.png",
      description: "Frutal, Especiado",
      altitude: "1,500m"
    },
    {
      name: "Brasil Cerrado",
      image: "/assets/brasil.png",
      description: "Nuez, Caramelo",
      altitude: "1,200m"
    },
    {
      name: "Perú Chanchamayo",
      image: "/assets/colombia-bruselas.png",
      description: "Floral, Miel",
      altitude: "1,600m"
    },
    {
      name: "Costa Rica Tarrazú",
      image: "/assets/blend.png",
      description: "Brillante, Cítrico",
      altitude: "1,900m"
    }
  ];

  return (
    <section id="origenes" className="py-16 lg:py-24">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            Orígenes Directos<br />
            Cada café tiene su{" "}
            <span className="text-primary">propia historia</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Trabajamos directamente con productores. Sin intermediarios, sin misterios. 
            Cada personaje representa un origen, cada origen una tradición.
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
                <h3 className="font-semibold text-foreground">Maestro de {origin.name}</h3>
                <p className="text-sm text-muted-foreground">{origin.description}</p>
                <div className="flex items-center justify-center">
                  <span className="text-xs text-primary font-medium">{origin.altitude}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoffeeOrigins;