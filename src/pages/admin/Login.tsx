import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
export default function AdminLogin() {
  const { signInAdmin } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("comasnicolas@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Error de acceso", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acceso exitoso", description: "Redirigiendo..." });
    }
  };

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>Iniciar sesión Admin | TUPÁ Hub</title>
        <meta name="description" content="Accede al panel admin de TUPÁ Hub" />
        <link rel="canonical" href="/admin/login" />
      </Helmet>

      <section className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2 items-stretch">
          <aside className="hidden md:flex flex-col justify-between rounded-2xl bg-gradient-brand p-8 text-primary-foreground shadow-elegant">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <h2 className="text-3xl font-semibold tracking-tight">Panel Admin</h2>
              </div>
              <p className="mt-2 max-w-sm text-sm/6 opacity-90">
                Control total sobre clientes, integración de sistemas y reportes.
              </p>
            </div>
            <ul className="mt-8 space-y-3 text-sm/6">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Auditorías y calidad
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Integraciones centralizadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Analíticas operativas
              </li>
            </ul>
            <p className="mt-6 text-xs/5 opacity-80">© {new Date().getFullYear()} TUPÁ. Todos los derechos reservados.</p>
          </aside>

          <article className="flex items-center">
            <Card className="w-full shadow-elegant">
              <CardHeader className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-semibold">Ingresar al panel administrativo</h1>
                <p className="text-muted-foreground">Gestiona clientes, catálogos e integraciones.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={signInAdmin} variant="secondary" className="w-full">
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
                      placeholder="admin@tupa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="username"
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

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>

                <p className="text-sm text-muted-foreground text-center">
                  ¿Eres cliente? {" "}
                  <Link to="/app/login" className="text-primary underline-offset-4 hover:underline">
                    Ir al acceso de cliente
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
