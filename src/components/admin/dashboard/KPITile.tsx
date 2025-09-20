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
    <Card className={cn("overflow-hidden transition-all duration-300", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1">
            <div className="text-3xl font-bold leading-none tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {value}
            </div>
            {typeof delta === "number" && (
              <div className={cn(
                "mt-3 flex items-center gap-2 text-sm font-medium rounded-full px-3 py-1 w-fit",
                positive 
                  ? "text-success bg-success/10" 
                  : "text-destructive bg-destructive/10"
              )}
                   aria-live="polite">
                {positive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{positive ? "+" : ""}{delta.toFixed(1)}%</span>
                <span className="text-muted-foreground font-normal">vs. anterior</span>
              </div>
            )}
          </div>
          {data.length > 0 && (
            <div className="w-32 opacity-70 hover:opacity-100 transition-opacity">
              <Sparkline data={data} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KPITile;
