import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUpdatePassword } from "@/hooks/useUpdatePassword";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const ctx = params.get("ctx");

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState<string | null>(null);

  const { mutate, isPending } = useUpdatePassword();

  useEffect(() => {
    // Suscribirse primero
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });

    // Luego obtener sesión existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const backLogin = ctx === "admin" ? "/admin/login" : "/app/login";
  const forgotUrl = `/auth/forgot-password${ctx ? `?ctx=${ctx}` : ""}`;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMismatch(null);

    if (password.length < 8) {
      setMismatch("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMismatch("Las contraseñas no coinciden.");
      return;
    }

    mutate({ password });
  };

  const invalidState = hasSession === false;

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>Restablecer contraseña | TUPÁ Hub</title>
        <meta name="description" content="Ingresa tu nueva contraseña para completar la recuperación." />
        <link rel="canonical" href={`${window.location.origin}/auth/reset-password`} />
      </Helmet>

      <section className="container mx-auto px-4 py-10 max-w-xl">
        <Card className="shadow-elegant">
          <CardHeader>
            <h1 className="text-2xl md:text-3xl font-semibold">Restablecer contraseña</h1>
            <p className="text-muted-foreground">Ingresa tu nueva contraseña para tu cuenta.</p>
          </CardHeader>
          <CardContent>
            {invalidState ? (
              <div className="space-y-4" aria-live="polite">
                <p>El enlace de recuperación no es válido o expiró.</p>
                <Button asChild className="w-full">
                  <Link to={forgotUrl}>Solicitar uno nuevo</Link>
                </Button>
              </div>
            ) : hasSession === null ? (
              <p className="text-sm text-muted-foreground">Verificando enlace...</p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5" aria-live="polite">
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repite tu nueva contraseña"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {mismatch && <p className="text-sm text-destructive" role="status">{mismatch}</p>}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Actualizando..." : "Actualizar contraseña"}
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  <Link to={backLogin} className="underline underline-offset-4">Volver a iniciar sesión</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
