
import { ReactNode } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Home, Coffee, LineChart, Package, Users2, GraduationCap, CircleHelp, Settings, Users, Layers, ListChecks, BarChart3, Bean, Warehouse, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink, useLocation } from "react-router-dom";
import { useDataStore } from "@/lib/data-store";
import LocationSwitcher from "@/components/app/LocationSwitcher";
import UserMenu from "@/components/layout/UserMenu";
import GlobalSearch from "@/components/admin/GlobalSearch";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useUserRole } from "@/hooks/useTeam";
export type AppShellProps = {
  children: ReactNode;
  section?: string;
  variant?: "client" | "admin";
};

type NavItem = { icon: any; label: string; to: string; exact?: boolean };

const clientItems: NavItem[] = [
  { icon: Home, label: "Dashboard", to: "/app", exact: true },
  { icon: Coffee, label: "Recetas", to: "/app/recipes" },
  { icon: LineChart, label: "Consumo", to: "/app/consumption" },
  { icon: Package, label: "Reposición", to: "/app/replenishment" },
  { icon: Users2, label: "Mi Equipo", to: "/app/my-team" },
  { icon: GraduationCap, label: "Academia", to: "/app/academy" },
  { icon: CircleHelp, label: "FAQ", to: "/app/loyalty" },
];

const adminItems: NavItem[] = [
  { icon: Home, label: "Dashboard", to: "/admin", exact: true },
  { icon: Users, label: "Clientes", to: "/admin/clients" },
  { icon: Layers, label: "Entitlements", to: "/admin/entitlements" },
  { icon: Settings, label: "Integraciones", to: "/admin/integrations" },
  { icon: ListChecks, label: "Cola de Pedidos", to: "/admin/orders-queue" },
  { icon: Bean, label: "Variedades de Café", to: "/admin/coffee-varieties" },
  { icon: Warehouse, label: "Stock de Ubicaciones", to: "/admin/location-stock" },
  { icon: BarChart3, label: "Analytics", to: "/admin/reports/analytics" },
];

export function AppShell({ children, section = "Dashboard", variant = "client" }: AppShellProps) {
  const baseItems = variant === "admin" ? adminItems : clientItems;
  const { pathname } = useLocation();
  const { ordersQueue } = useDataStore();
  const { isLoading, flags, posEffective } = useFeatureFlags();
  const { data: effectiveRole } = useUserRole();

  // Compute gated items for client variant
  const items = variant === "client" && flags
    ? baseItems.filter((n) => {
        if (n.to === "/app/replenishment") return flags.auto_order_enabled;
        if (n.to === "/app/academy") return flags.academy_enabled;
        if (n.to === "/app/loyalty") return flags.loyalty_enabled;
        return true;
      })
    : baseItems;

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className={cn("size-8 rounded-md bg-primary/10 flex items-center justify-center font-semibold", variant === "admin" && "bg-primary/20")}>TU</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">TUPÁ Hub</div>
              <div className="text-xs text-muted-foreground">{variant === "admin" ? "Panel Admin" : "Portal Cliente"}</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {variant === "client" && isLoading ? (
                  // Preserve layout with skeletons while flags load
                  Array.from({ length: 5 }).map((_, i) => (
                    <SidebarMenuItem key={`sk-${i}`}>
                      <div className="h-8 rounded bg-muted w-full" />
                    </SidebarMenuItem>
                  ))
                ) : (
                  items.map((n) => {
                    const isActive = n.exact ? pathname === n.to : pathname.startsWith(n.to);
                    return (
                      <SidebarMenuItem key={n.label}>
                        <SidebarMenuButton isActive={isActive} tooltip={n.label} asChild>
                          <NavLink to={n.to} aria-current={isActive ? "page" : undefined}>
                            <n.icon />
                            <span>{n.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                        {n.label === "Reposición" && ordersQueue.length > 0 && (
                          <SidebarMenuBadge>{ordersQueue.length}</SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Configuración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {(variant === "admin" || effectiveRole === 'owner' || effectiveRole === 'manager' || effectiveRole === 'tupa_admin') && (
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Integraciones" asChild>
                      <NavLink to={variant === "admin" ? "/admin/integrations" : "/app/settings/integrations"}>
                        <Settings />
                        <span>Integraciones</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-1 text-xs text-muted-foreground">TUPÁ Hub · Sistema Integral</div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex h-14 items-center gap-2 px-4 animate-fade-in">
            <SidebarTrigger className="hover-scale" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Inicio</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{section}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch variant={variant} />
              {variant === "client" && <LocationSwitcher />}
              <Button variant="soft" className="hidden sm:inline-flex">Recomendación IA</Button>
              <UserMenu variant={variant} />
            </div>
          </div>
        </header>
        <main className="w-full animate-fade-in">
          <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-4 md:py-6">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
