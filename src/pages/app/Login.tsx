import React from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export default function AppLogin() {
  const { signInClient } = useAuth();
  return (
    <main className="container mx-auto p-6 max-w-md">
      <Helmet>
        <title>Login Cliente | TUPÁ Hub</title>
        <meta name="description" content="Accede al portal cliente de TUPÁ Hub" />
        <link rel="canonical" href="/app/login" />
      </Helmet>
      <Card>
        <CardHeader>
          <CardTitle>Ingresar al Portal Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm">Email</label>
          <Input type="email" placeholder="tu@cafeteria.com" />
          <Button onClick={signInClient} className="w-full">Entrar</Button>
        </CardContent>
      </Card>
    </main>
  );
}
