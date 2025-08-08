import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      el.style.setProperty("--x", `${x}px`);
      el.style.setProperty("--y", `${y}px`);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>TUPÁ Hub – Gestión de café moderna</title>
        <meta name="description" content="PWA para tostadores y clientes: consumo real, stock, recetas, Academy y reposición automática con IA." />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/'} />
      </Helmet>
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: "radial-gradient(600px 300px at var(--x) var(--y), hsl(var(--primary)/0.25), transparent 60%)",
        }}
      />
      <main className="relative z-10 flex min-h-screen items-center justify-center bg-background">
        <section className="container mx-auto text-center px-6 py-24">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
              TUPÁ Hub
            </h1>
            <p className="mt-4 text-lg md:text-xl text-muted-foreground">
              La plataforma integral para gestionar consumo, stock y calidad del café con reposición automática, recetas y Academy.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="/app" aria-label="Entrar al portal cliente">
                <Button variant="hero" size="lg">Entrar como Cliente</Button>
              </a>
              <a href="/admin" aria-label="Entrar al panel admin">
                <Button variant="outline" size="lg">Entrar como Admin</Button>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
