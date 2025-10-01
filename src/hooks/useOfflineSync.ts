import { useState, useEffect, useCallback } from 'react';
import { offlineDB, type OfflineQueueItem } from '@/lib/offline-db';
import { useToast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Conexión restaurada",
        description: "Sincronizando datos pendientes...",
      });
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Sin conexión",
        description: "Los cambios se guardarán localmente",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  // Listen for service worker sync messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        updateQueueCount();
        toast({
          title: "Sincronización completa",
          description: `${event.data.pendingCount} elementos sincronizados`,
        });
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [toast]);

  // Update queue count
  const updateQueueCount = useCallback(async () => {
    try {
      const items = await offlineDB.getQueueItems();
      setQueueCount(items.length);
    } catch (error) {
      console.error('Failed to update queue count:', error);
    }
  }, []);

  // Initial queue count
  useEffect(() => {
    updateQueueCount();
  }, [updateQueueCount]);

  // Add item to offline queue
  const addToQueue = useCallback(async (
    url: string,
    method: string,
    data: any,
    headers: Record<string, string> = {}
  ) => {
    try {
      const item: Omit<OfflineQueueItem, 'id'> = {
        timestamp: Date.now(),
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        data,
        retryCount: 0,
      };

      await offlineDB.addToQueue(item);
      await updateQueueCount();

      // Request background sync if available
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        try {
          const registration = await navigator.serviceWorker.ready;
          // @ts-ignore - Background Sync API may not be in types
          await registration.sync.register('sync-calibrations');
        } catch (error) {
          console.warn('Background sync not available:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to add to queue:', error);
      return false;
    }
  }, [updateQueueCount]);

  // Manual sync
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const items = await offlineDB.getQueueItems();
      
      for (const item of items) {
        try {
          const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: JSON.stringify(item.data),
          });

          if (response.ok) {
            await offlineDB.removeFromQueue(item.id!);
          } else if (response.status >= 500) {
            // Server error, retry later
            console.warn('Server error, will retry:', item.id);
          } else {
            // Client error, remove from queue
            await offlineDB.removeFromQueue(item.id!);
          }
        } catch (error) {
          console.error('Sync failed for item:', item.id, error);
        }
      }

      await updateQueueCount();
      
      if (items.length > 0) {
        toast({
          title: "Sincronización completa",
          description: `${items.length} elementos procesados`,
        });
      }
    } catch (error) {
      console.error('Queue sync failed:', error);
      toast({
        title: "Error de sincronización",
        description: "Algunos elementos no se pudieron sincronizar",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updateQueueCount, toast]);

  // Clear queue
  const clearQueue = useCallback(async () => {
    try {
      await offlineDB.clearQueue();
      await updateQueueCount();
      toast({
        title: "Cola limpiada",
        description: "Todos los elementos pendientes fueron eliminados",
      });
    } catch (error) {
      console.error('Failed to clear queue:', error);
      toast({
        title: "Error",
        description: "No se pudo limpiar la cola",
        variant: "destructive",
      });
    }
  }, [updateQueueCount, toast]);

  return {
    isOnline,
    queueCount,
    isSyncing,
    addToQueue,
    syncQueue,
    clearQueue,
  };
}
