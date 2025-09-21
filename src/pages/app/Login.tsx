
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AppLogin() {
  const { signInClient } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (attempted && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        setLoading(false);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [attempted]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setAttempted(true);
    setLoading(true);
    // Guardamos el redirect para que AuthProvider navegue tras resolver el rol
    localStorage.setItem("tupa_auth_redirect", "/app");
    console.log("[AppLogin] redirect -> /app guardado en localStorage");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast({ title: "Error de acceso", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acceso exitoso", description: "Redirigiendo..." });
      console.log("[AppLogin] login OK, esperando onAuthStateChange para navegar");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-soft relative overflow-hidden">
      <Helmet>
        <title>Iniciar sesión Cliente | TUPÁ Hub</title>
        <meta name="description" content="Accede al portal cliente de TUPÁ Hub" />
        <link rel="canonical" href="/app/login" />
      </Helmet>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-primary opacity-20 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-accent opacity-15 rounded-full blur-3xl animate-float-slow-reverse"></div>
      </div>

      <section className="container mx-auto px-4 py-8 relative z-10">
        <div className="grid gap-8 lg:grid-cols-2 items-stretch min-h-[calc(100vh-4rem)]">
          {/* Left Panel - Brand Info */}
          <aside className="hidden lg:flex flex-col justify-between rounded-3xl bg-gradient-brand p-10 text-primary-foreground shadow-glow relative overflow-hidden animate-fade-in">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm mb-6">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium">Sistema activo</span>
              </div>
              
              <p className="text-sm/6 opacity-90 mb-2">Bienvenido a</p>
              <h2 className="text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text">
                TUPÁ Hub
              </h2>
              <p className="max-w-sm text-base/7 opacity-90">
                El panel inteligente para gestionar tus operaciones de cafetería: 
                pedidos, stock, lealtad y mucho más.
              </p>
            </div>

            <div className="relative z-10">
              <ul className="space-y-4 text-sm/6">
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm hover-lift transition-all duration-300">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span>Acceso seguro y centralizado</span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm hover-lift transition-all duration-300">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span>Reportes y analíticas en tiempo real</span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-xl bg-white/10 backdrop-blur-sm hover-lift transition-all duration-300">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span>Integraciones con tu ecosistema</span>
                </li>
              </ul>
            </div>

            <div className="relative z-10">
              <p className="text-xs/5 opacity-70">
                © {new Date().getFullYear()} TUPÁ. Todos los derechos reservados.
              </p>
            </div>
          </aside>

          {/* Right Panel - Login Form */}
          <article className="flex items-center justify-center animate-fade-in-up">
            <Card className="w-full max-w-md glass shadow-glow border-white/20 animate-scale-in">
              <CardHeader className="space-y-3 text-center pb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 shadow-soft">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">T</span>
                  </div>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Bienvenido de vuelta
                </h1>
                <p className="text-muted-foreground">
                  Accede a tu portal para gestionar tu cafetería
                </p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <Button 
                  onClick={() => signInClient()} 
                  variant="secondary" 
                  className="w-full h-12 text-base font-medium hover-lift transition-all duration-300"
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </Button>

                <div className="flex items-center gap-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-full">
                    o continua con email
                  </span>
                  <Separator className="flex-1" />
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Correo electrónico
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@cafeteria.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="email"
                      className="h-12 text-base transition-all duration-300 focus:ring-4 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Contraseña
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="current-password"
                      className="h-12 text-base transition-all duration-300 focus:ring-4 focus:ring-primary/20"
                    />
                  </div>

                  <div className="text-right">
                    <Link 
                      to="/auth/forgot-password?ctx=app" 
                      className="text-sm text-primary font-medium underline-offset-4 hover:underline transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-medium hover-lift transition-all duration-300" 
                    disabled={loading} 
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 
                        Iniciando sesión...
                      </>
                    ) : (
                      <>
                        Iniciar sesión
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground text-center">
                    ¿Eres administrador?{" "}
                    <Link 
                      to="/admin/login" 
                      className="text-primary font-medium underline-offset-4 hover:underline transition-colors"
                    >
                      Acceso de administrador
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </article>
        </div>
      </section>
    </main>
  );
}
