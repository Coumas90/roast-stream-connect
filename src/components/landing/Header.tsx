import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b border-border z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-primary">TUPÁ</div>
            <div className="text-sm text-muted-foreground">Hub</div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#que-es-tupa" className="text-foreground hover:text-primary transition-colors">
              ¿Qué es TUPÁ?
            </a>
            <a href="#origenes" className="text-foreground hover:text-primary transition-colors">
              Orígenes
            </a>
            <a href="#segmentos" className="text-foreground hover:text-primary transition-colors">
              Segmentos
            </a>
            <a href="#tecnologia" className="text-foreground hover:text-primary transition-colors">
              Tecnología
            </a>
            <a href="#catalogo" className="text-foreground hover:text-primary transition-colors">
              Catálogo
            </a>
          </nav>

          {/* Desktop Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <a href="/app">Iniciar Sesión</a>
            </Button>
            <Button asChild>
              <a href="#cta">Prueba TUPÁ Gratis</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 pb-4 border-t border-border">
            <div className="flex flex-col space-y-4 pt-4">
              <a href="#que-es-tupa" className="text-foreground hover:text-primary transition-colors">
                ¿Qué es TUPÁ?
              </a>
              <a href="#origenes" className="text-foreground hover:text-primary transition-colors">
                Orígenes
              </a>
              <a href="#segmentos" className="text-foreground hover:text-primary transition-colors">
                Segmentos
              </a>
              <a href="#tecnologia" className="text-foreground hover:text-primary transition-colors">
                Tecnología
              </a>
              <a href="#catalogo" className="text-foreground hover:text-primary transition-colors">
                Catálogo
              </a>
              <div className="flex flex-col space-y-2 pt-4">
                <Button variant="ghost" asChild>
                  <a href="/app">Iniciar Sesión</a>
                </Button>
                <Button asChild>
                  <a href="#cta">Prueba TUPÁ Gratis</a>
                </Button>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;