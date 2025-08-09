
import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthIllustration from "@/components/auth/AuthIllustration";

export default function AppLogin() {
  const { signInClient } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      <AuthLayout
        aside={
          <AuthIllustration
            images={[
              "/auth/coffee-01.jpg",
              "/auth/coffee-02.jpg",
              "/auth/coffee-03.jpg",
              "/auth/coffee-04.jpg",
              "/auth/coffee-05.jpg",
              "/auth/coffee-06.jpg",
              "/auth/coffee-07.jpg",
              "/auth/coffee-08.jpg",
              "/auth/coffee-09.jpg",
              "/auth/coffee-10.jpg",
            ]}
            title="TUPÁ Hub"
            description="El panel para gestionar tus operaciones de cafetería: pedidos, stock, lealtad y más."
            features={[
              { text: "Acceso seguro y centralizado" },
              { text: "Reportes y analíticas en vivo" },
              { text: "Integraciones con tu ecosistema" },
            ]}
          />
        }
      >
        <Card className="w-full shadow-elegant">
          <CardHeader className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold">Accede a tu portal cliente</h1>
            <p className="text-muted-foreground">Gestiona pedidos, programa reposiciones y más.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={signInClient} variant="secondary" className="w-full">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-1.6 3.6-5.4 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.6 2.6 14.5 1.8 12 1.8 6.9 1.8 2.8 5.9 2.8 11s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1-.2-1.4H12z"/>
                <path fill="#34A853" d="M3.9 7.3l3.2 2.4C8 7.2 9.8 6 12 6c1.9 0 3.2.8 3.9 1.5l2.7-2.7C16.6 2.6 14.5 1.8 12 1.8 8 1.8 4.6 4 3.9 7.3z" opacity=".7"/>
                <path fill="#4285F4" d="M12 20.2c3.8 0 5.2-2.4 5.4-3.6H12v-3.9h8.8c.1.4.2.8.2 1.4 0 5.3-3.5 9-8.8 9-5.1 0-9.2-4.1-9.2-9.2 0-1.4.3-2.7.9-3.9l3.2 2.4C6.9 14.6 9 16.6 12 16.6z" opacity=".9"/>
                <path fill="#FBBC05" d="M3.9 7.3l3.2 2.4C7 10.2 6.6 10.9 6.6 12c0 1.2.4 2 .5 2.3L3.9 16.7C3.3 15.5 3 14.2 3 12.9c0-1.4.3-2.7.9-3.9z" opacity=".9"/>
              </svg>
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu clave"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <Link to="/auth/forgot-password?ctx=app" className="text-sm text-primary underline-offset-4 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
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
      </AuthLayout>
    </main>
  );
}
