import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRequestPasswordReset } from "@/hooks/useRequestPasswordReset";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [params] = useSearchParams();
  const ctx = params.get("ctx");
  const { mutate, isPending, isSuccess, error } = useRequestPasswordReset();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    mutate(email);
  };

  const backLogin = ctx === "admin" ? "/admin/login" : "/app/login";

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>Recuperar contraseña | TUPÁ Hub</title>
        <meta name="description" content="Recupera tu contraseña por email de forma segura." />
        <link rel="canonical" href={`${window.location.origin}/auth/forgot-password`} />
      </Helmet>

      <section className="container mx-auto px-4 py-10 max-w-xl">
        <Card className="shadow-elegant">
          <CardHeader>
            <h1 className="text-2xl md:text-3xl font-semibold">¿Olvidaste tu contraseña?</h1>
            <p className="text-muted-foreground">Te enviaremos un enlace para restablecerla.</p>
          </CardHeader>
          <CardContent>
            {!isSuccess ? (
              <form onSubmit={onSubmit} className="space-y-5" aria-live="polite">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="status">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Enviando..." : "Enviar enlace"}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  <Link to={backLogin} className="underline underline-offset-4">Volver a iniciar sesión</Link>
                </p>
              </form>
            ) : (
              <div className="space-y-4" aria-live="polite">
                <p>Si el correo existe, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja.</p>
                <Button asChild className="w-full">
                  <Link to={backLogin}>Volver a iniciar sesión</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
