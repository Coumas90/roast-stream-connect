import React from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export default function AdminLogin() {
  const { signInAdmin } = useAuth();
  return (
    <main className="container mx-auto p-6 max-w-md">
      <Helmet>
        <title>Login Admin | TUPÁ Hub</title>
        <meta name="description" content="Accede al panel admin de TUPÁ Hub" />
        <link rel="canonical" href="/admin/login" />
      </Helmet>
      <Card>
        <CardHeader>
          <CardTitle>Ingresar al Panel Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm">Email</label>
          <Input type="email" placeholder="admin@tupa.com" />
          <Button onClick={signInAdmin} className="w-full">Entrar</Button>
        </CardContent>
      </Card>
    </main>
  );
}
