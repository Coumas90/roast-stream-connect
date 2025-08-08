import { Helmet } from "react-helmet-async";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const data = [
  { name: "Ene", consumo: 12 },
  { name: "Feb", consumo: 14 },
  { name: "Mar", consumo: 13 },
  { name: "Abr", consumo: 15 },
  { name: "May", consumo: 16 },
  { name: "Jun", consumo: 18 },
];

export default function AppHome() {
  return (
    <AppShell section="Dashboard" variant="client">
      <Helmet>
        <title>TUPÁ Hub – Dashboard cliente</title>
        <meta name="description" content="Monitorea consumo real, stock y reposición automática con TUPÁ Hub." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/app'} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "TUPÁ Hub",
          applicationCategory: "BusinessApplication",
          offers: { "@type": "Offer", price: "0" }
        })}</script>
      </Helmet>
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stock Actual</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">45kg</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Consumo Mensual</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">28kg</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cobertura</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">32 días</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Eficiencia</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">87%</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3 mt-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Consumo Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ consumo: { label: "Consumo (kg)", color: "hsl(var(--primary))" } }}
              className="h-[320px]"
            >
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="consumo" fill="var(--color-consumo)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recomendación de Reposición</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Basado en tu ritmo de consumo actual y stock disponible.</p>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-semibold">25kg</div>
              <div className="text-sm">Finca La Esperanza<br />en 8 días</div>
            </div>
            <Button className="mt-4" variant="soft">Aplicar Recomendación</Button>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
