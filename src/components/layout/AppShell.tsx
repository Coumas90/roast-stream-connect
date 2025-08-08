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
import { Home, Coffee, LineChart, Package, Users2, GraduationCap, CircleHelp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  children: ReactNode;
  section?: string;
  variant?: "client" | "admin";
};

const NavItems = [
  { icon: Home, label: "Dashboard", href: "#" },
  { icon: Coffee, label: "Recetas", href: "#" },
  { icon: LineChart, label: "Consumo", href: "#" },
  { icon: Package, label: "Reposición", href: "#" },
  { icon: Users2, label: "Mi Equipo", href: "#" },
  { icon: GraduationCap, label: "Academia", href: "#" },
  { icon: CircleHelp, label: "FAQ", href: "#" },
];

export function AppShell({ children, section = "Dashboard", variant = "client" }: AppShellProps) {
  return (
    <SidebarProvider>
      <Sidebar variant="inset">
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
                {NavItems.map((n) => (
                  <SidebarMenuItem key={n.label}>
                    <SidebarMenuButton isActive={n.label === section} asChild>
                      <a href="#" aria-current={n.label === section ? "page" : undefined}>
                        <n.icon />
                        <span>{n.label}</span>
                      </a>
                    </SidebarMenuButton>
                    {n.label === "Reposición" && <SidebarMenuBadge>3</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarGroupLabel>Configuración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a href="#">
                      <Settings />
                      <span>Integraciones</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 py-1 text-xs text-muted-foreground">TUPÁ Hub · Sistema Integral</div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex h-14 items-center gap-2 px-4">
            <SidebarTrigger />
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
              <Button variant="soft" className="hidden sm:inline-flex">Recomendación IA</Button>
              <Button variant="pill" size="sm">CO</Button>
            </div>
          </div>
        </header>
        <main className="container mx-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
