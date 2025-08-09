import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils";

export type KPITileProps = {
  title: string;
  value: string | number;
  delta?: number; // percentage
  data?: number[];
  className?: string;
};

export function KPITile({ title, value, delta, data = [], className }: KPITileProps) {
  const positive = typeof delta === "number" ? delta >= 0 : undefined;
  return (
    <Card className={cn("overflow-hidden hover-scale animate-fade-in", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold leading-none tracking-tight">{value}</div>
            {typeof delta === "number" && (
              <div className={cn("mt-2 flex items-center gap-1 text-xs", positive ? "text-primary" : "text-destructive")}
                   aria-live="polite">
                {positive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{positive ? "+" : ""}{delta.toFixed(1)}%</span>
                <span className="text-muted-foreground">vs. mes anterior</span>
              </div>
            )}
          </div>
          {data.length > 0 && (
            <div className="w-32">
              <Sparkline data={data} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KPITile;
