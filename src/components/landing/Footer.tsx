import { Coffee, Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  const footerSections = [
    {
      title: "Producto",
      links: [
        { name: "¿Qué es TUPÁ?", href: "#que-es-tupa" },
        { name: "Orígenes", href: "#origenes" },
        { name: "Tecnología", href: "#tecnologia" },
        { name: "Academy", href: "#academy" },
        { name: "Precios", href: "#precios" }
      ]
    },
    {
      title: "Segmentos",
      links: [
        { name: "Cafeterías", href: "#cafeterias" },
        { name: "Oficinas", href: "#oficinas" },
        { name: "Restaurantes", href: "#restaurantes" },
        { name: "Tostadores", href: "#tostadores" },
        { name: "Distribuidores", href: "#distribuidores" }
      ]
    },
    {
      title: "Soporte",
      links: [
        { name: "Centro de Ayuda", href: "#ayuda" },
        { name: "Documentación", href: "#docs" },
        { name: "API", href: "#api" },
        { name: "Estado del Sistema", href: "#status" },
        { name: "Contacto", href: "#contacto" }
      ]
    },
    {
      title: "Empresa",
      links: [
        { name: "Sobre Nosotros", href: "#about" },
        { name: "Careers", href: "#careers" },
        { name: "Blog", href: "#blog" },
        { name: "Prensa", href: "#press" },
        { name: "Inversionistas", href: "#investors" }
      ]
    }
  ];

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Twitter, href: "#", label: "Twitter" }
  ];

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center space-x-2">
              <Coffee className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold text-foreground">TUPÁ</div>
                <div className="text-sm text-muted-foreground">Hub</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Transformando la experiencia del café con tecnología inteligente 
              y productos de origen trazable.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>ventas@cafetupa.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>+54 9 11 2514-5969</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Capital Federal, Argentina</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          {footerSections.map((section, index) => (
            <div key={index} className="space-y-4">
              <h4 className="font-semibold text-foreground">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 TUPÁ Hub. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#privacy" className="hover:text-primary transition-colors">
                Política de Privacidad
              </a>
              <a href="#terms" className="hover:text-primary transition-colors">
                Términos de Servicio
              </a>
              <a href="#cookies" className="hover:text-primary transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;