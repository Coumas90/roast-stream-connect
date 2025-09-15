import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, BookOpen, Settings, Bell, TrendingUp, Package } from "lucide-react";
import { useStockMetrics } from "@/hooks/useLocationStock";
import { useOrderMetrics } from "@/hooks/useOrderHistory";

interface QuickActionsProps {
  locationId?: string;
}

export function QuickActions({ locationId }: QuickActionsProps) {
  const { lowStockItems } = useStockMetrics(locationId);
  const { pendingOrders } = useOrderMetrics(locationId);

  const actions = [
    {
      title: "Hacer Pedido",
      description: "Solicitar reposición de café",
      icon: ShoppingCart,
      href: "/app/replenishment",
      variant: "default" as const,
      badge: lowStockItems.length > 0 ? `${lowStockItems.length} bajo stock` : null
    },
    {
      title: "Ver Recetas",
      description: "Explorar recetas recomendadas",
      icon: BookOpen,
      href: "/app/recipes",
      variant: "outline" as const
    },
    {
      title: "Estado de Pedidos",
      description: "Revisar pedidos pendientes",
      icon: Package,
      href: "/app/replenishment",
      variant: "outline" as const,
      badge: pendingOrders > 0 ? `${pendingOrders} pendientes` : null
    },
    {
      title: "Configuraciones",
      description: "Gestionar integraciones",
      icon: Settings,
      href: "/app/settings/integrations",
      variant: "outline" as const
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Acciones Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.title}
              variant={action.variant}
              asChild
              className="w-full justify-start h-auto p-4"
            >
              <a href={action.href}>
                <div className="flex items-center gap-3 w-full">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{action.title}</span>
                      {action.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </div>
              </a>
            </Button>
          );
        })}
        
        {(lowStockItems.length > 0 || pendingOrders > 0) && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 text-primary">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">Notificaciones</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {lowStockItems.length > 0 && (
                <div>• {lowStockItems.length} café(s) con stock bajo</div>
              )}
              {pendingOrders > 0 && (
                <div>• {pendingOrders} pedido(s) pendientes</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}