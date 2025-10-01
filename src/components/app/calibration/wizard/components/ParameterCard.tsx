import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ParameterCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  status?: "good" | "warning" | "error";
  metric?: string;
  info?: string;
}

export function ParameterCard({
  title,
  description,
  children,
  status,
  metric,
  info,
}: ParameterCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case "good":
        return "border-green-500/50 bg-green-50/50 dark:bg-green-950/20";
      case "warning":
        return "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20";
      case "error":
        return "border-red-500/50 bg-red-50/50 dark:bg-red-950/20";
      default:
        return "";
    }
  };

  const getStatusIndicator = () => {
    if (!status) return null;
    
    const color = {
      good: "bg-green-500",
      warning: "bg-yellow-500",
      error: "bg-red-500",
    }[status];

    return <div className={cn("w-2 h-2 rounded-full", color)} />;
  };

  return (
    <Card className={cn("p-6 transition-all", getStatusColor())}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{title}</h3>
              {getStatusIndicator()}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {info && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{info}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Content */}
        <div>{children}</div>

        {/* Metric */}
        {metric && (
          <div className="text-sm text-muted-foreground text-center pt-2 border-t">
            {metric}
          </div>
        )}
      </div>
    </Card>
  );
}
