import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline, queueCount, isSyncing, syncQueue } = useOfflineSync();

  if (isOnline && queueCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert className={cn(
        "shadow-lg",
        !isOnline && "border-amber-500 bg-amber-50"
      )}>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-amber-600" />
          )}
          
          <div className="flex-1">
            <AlertDescription className="text-sm">
              {!isOnline ? (
                <span className="font-medium">Sin conexión</span>
              ) : queueCount > 0 ? (
                <span className="font-medium">Sincronizando datos</span>
              ) : null}
              
              {queueCount > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {queueCount} pendiente{queueCount !== 1 ? 's' : ''}
                  </Badge>
                  {isOnline && !isSyncing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={syncQueue}
                      className="h-6 px-2 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sincronizar
                    </Button>
                  )}
                  {isSyncing && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Sincronizando...
                    </span>
                  )}
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
}
