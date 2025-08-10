
import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AppLogin() {
  const { signInClient } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Guardamos el redirect para que AuthProvider navegue tras resolver el rol
    localStorage.setItem("tupa_auth_redirect", "/app");
    console.log("[AppLogin] redirect -> /app guardado en localStorage");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Error de acceso", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acceso exitoso", description: "Redirigiendo..." });
      console.log("[AppLogin] login OK, esperando onAuthStateChange para navegar");
    }
  };

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>Iniciar sesión Cliente | TUPÁ Hub</title>
        <meta name="description" content="Accede al portal cliente de TUPÁ Hub" />
        <link rel="canonical" href="/app/login" />
      </Helmet>

      <section className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2 items-stretch">
          <aside className="hidden md:flex flex-col justify-between rounded-2xl bg-gradient-brand p-8 text-primary-foreground shadow-elegant">
            <div>
              <p className="text-sm/6 opacity-90">Bienvenido a</p>
              <h2 className="text-3xl font-semibold tracking-tight">TUPÁ Hub</h2>
              <p className="mt-2 max-w-sm text-sm/6 opacity-90">
                El panel para gestionar tus operaciones de cafetería: pedidos, stock,
                lealtad y más.
              </p>
            </div>
            <ul className="mt-8 space-y-3 text-sm/6">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Acceso seguro y centralizado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Reportes y analíticas en vivo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Integraciones con tu ecosistema
              </li>
            </ul>
            <p className="mt-6 text-xs/5 opacity-80">© {new Date().getFullYear()} TUPÁ. Todos los derechos reservados.</p>
          </aside>

          <article className="flex items-center">
            <Card className="w-full shadow-elegant">
              <CardHeader className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-semibold">Accede a tu portal cliente</h1>
                <p className="text-muted-foreground">Gestiona pedidos, programa reposiciones y más.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={signInClient} variant="secondary" className="w-full">
                  Continuar con Google
                </Button>

                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">o continua con email</span>
                  <Separator className="flex-1" />
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@cafeteria.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Clave</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Tu clave"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="text-right">
                    <Link to="/auth/forgot-password?ctx=app" className="text-sm text-primary underline-offset-4 hover:underline">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                  ¿Eres administrador?{" "}
                  <Link to="/admin/login" className="text-primary underline-offset-4 hover:underline">
                    Ir al acceso de admin
                  </Link>
                </p>
              </CardContent>
            </Card>
          </article>
        </div>
      </section>
    </main>
  );
}
