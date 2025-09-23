import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, Coffee, Truck, Users } from "lucide-react";
import { useState } from "react";

const CTA = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    business: "",
    type: "",
    message: ""
  });

  const benefits = [
    { icon: Coffee, text: "Primer envío gratis" },
    { icon: Truck, text: "Setup incluido" },
    { icon: Users, text: "Sin permanencia" },
    { icon: Check, text: "Probá TUPÁ Gratis" }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
  };

  return (
    <section id="cta" className="py-16 lg:py-24 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-6">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-foreground">
            ¿Listo para transformar{" "}
            <span className="text-primary">tu experiencia de café?</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Primer envío gratis. Sin compromisos. Sin letra chica. Solo café extraordinario que eleva tu negocio.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Benefits */}
          <div className="space-y-8">
            <h3 className="text-2xl font-semibold text-foreground">
              Comienza con estos beneficios:
            </h3>
            
            <div className="grid gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-background/50 backdrop-blur-sm">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-foreground font-medium">{benefit.text}</span>
                </div>
              ))}
            </div>

            <Card className="border-0 bg-primary/5">
              <CardContent className="p-6">
                <h4 className="font-semibold text-foreground mb-2">Garantía TUPÁ</h4>
                <p className="text-sm text-muted-foreground">
                  Si no estás 100% satisfecho en los primeros 30 días, 
                  te devolvemos todo tu dinero sin preguntas.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Form */}
          <Card className="border-0 bg-background/80 backdrop-blur-sm shadow-xl">
            <CardHeader>
              <CardTitle className="text-center">Solicita tu prueba gratuita</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business">Nombre del negocio</Label>
                    <Input
                      id="business"
                      value={formData.business}
                      onChange={(e) => setFormData({...formData, business: e.target.value})}
                      placeholder="Nombre de tu cafetería"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+57 300 123 4567"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de negocio</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cafeteria">Cafetería</SelectItem>
                        <SelectItem value="oficina">Oficina</SelectItem>
                        <SelectItem value="restaurante">Restaurante</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Cuéntanos sobre tu negocio (opcional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    placeholder="Número de sucursales, consumo promedio, etc."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" size="lg" className="flex-1">
                    Probá TUPÁ Gratis
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1"
                    asChild
                  >
                    <a
                      href="https://wa.me/5491125145969?text=¡Hola! Me interesa conocer más sobre TUPÁ Hub"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Hablemos por WhatsApp
                    </a>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Al enviar este formulario aceptas nuestros{" "}
                  <a href="#" className="text-primary hover:underline">términos y condiciones</a> y{" "}
                  <a href="#" className="text-primary hover:underline">política de privacidad</a>.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default CTA;