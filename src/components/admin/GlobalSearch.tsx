import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Search, Home, Users, Layers, Settings, ListChecks, BarChart3 } from "lucide-react";

type GlobalSearchProps = {
  variant?: "client" | "admin";
};

export function GlobalSearch({ variant = "admin" }: GlobalSearchProps) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (to: string) => {
    navigate(to);
    setOpen(false);
  };

  const adminNav = [
    { to: "/admin", label: "Dashboard", icon: Home },
    { to: "/admin/clients", label: "Clientes", icon: Users },
    { to: "/admin/entitlements", label: "Entitlements", icon: Layers },
    { to: "/admin/integrations", label: "Integraciones", icon: Settings },
    { to: "/admin/orders-queue", label: "Cola de Pedidos", icon: ListChecks },
    { to: "/admin/reports/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const clientNav = [
    { to: "/app", label: "Dashboard", icon: Home },
  ];

  const nav = variant === "admin" ? adminNav : clientNav;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-40 justify-start gap-2 text-muted-foreground"
        aria-label="Abrir búsqueda global"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar…</span>
        <span className="sr-only sm:not-sr-only ml-auto" aria-hidden>
          <kbd className="pointer-events-none ml-auto hidden md:flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="text-xs">{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</span>K
          </kbd>
        </span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Busca páginas y acciones…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>

          <CommandGroup heading="Navegación">
            {nav.map((i) => (
              <CommandItem key={i.to} onSelect={() => go(i.to)}>
                <i.icon className="mr-2 h-4 w-4" />
                <span>{i.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {variant === "admin" && (
            <CommandGroup heading="Acciones rápidas">
              <CommandItem onSelect={() => go("/admin/clients")}>Crear tenant</CommandItem>
              <CommandItem onSelect={() => go("/admin/clients")}>Invitar owner</CommandItem>
              <CommandItem onSelect={() => go("/admin/integrations")}>Ver integraciones POS</CommandItem>
              <CommandItem onSelect={() => go("/admin/orders-queue")}>Revisar cola Odoo</CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default GlobalSearch;
