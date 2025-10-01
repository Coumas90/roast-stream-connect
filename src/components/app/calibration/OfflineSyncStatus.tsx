import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function OfflineSyncStatus() {
  const { isOnline } = useOfflineSync();

  return (
    <Badge 
      variant={isOnline ? "default" : "destructive"} 
      className="flex items-center gap-1"
    >
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          Online
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </Badge>
  );
}
