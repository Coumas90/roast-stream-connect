import { useState, useEffect, useCallback } from 'react';
import { offlineDB, type DraftCalibration, type CachedProfile } from '@/lib/offline-db';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useToast } from '@/hooks/use-toast';

export function useOfflineCalibration() {
  const { isOnline, addToQueue } = useOfflineSync();
  const { toast } = useToast();

  // Save draft calibration
  const saveDraft = useCallback(async (id: string, data: any) => {
    try {
      const draft: DraftCalibration = {
        id,
        data,
        timestamp: Date.now(),
      };
      
      await offlineDB.saveDraft(draft);
      
      return true;
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el borrador",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Load latest draft
  const loadLatestDraft = useCallback(async () => {
    try {
      const draft = await offlineDB.getLatestDraft();
      return draft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }, []);

  // Delete draft
  const deleteDraft = useCallback(async (id: string) => {
    try {
      await offlineDB.deleteDraft(id);
      return true;
    } catch (error) {
      console.error('Failed to delete draft:', error);
      return false;
    }
  }, []);

  // Cache active coffee profile
  const cacheProfile = useCallback(async (id: string, data: any) => {
    try {
      const profile: CachedProfile = {
        id,
        data,
        timestamp: Date.now(),
      };
      
      await offlineDB.cacheProfile(profile);
      return true;
    } catch (error) {
      console.error('Failed to cache profile:', error);
      return false;
    }
  }, []);

  // Get cached profile
  const getCachedProfile = useCallback(async (id: string) => {
    try {
      const profile = await offlineDB.getCachedProfile(id);
      return profile;
    } catch (error) {
      console.error('Failed to get cached profile:', error);
      return null;
    }
  }, []);

  // Save calibration (online or queue for offline)
  const saveCalibration = useCallback(async (data: any, apiUrl: string, token?: string) => {
    if (isOnline) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Save failed');
        }

        toast({
          title: "Calibración guardada",
          description: "La calibración se guardó correctamente",
        });

        return { success: true, online: true };
      } catch (error) {
        console.error('Online save failed, queuing:', error);
        // Fallback to offline queue
      }
    }

    // Queue for offline sync
    const queued = await addToQueue(
      apiUrl,
      'POST',
      data,
      token ? { 'Authorization': `Bearer ${token}` } : {}
    );

    if (queued) {
      toast({
        title: "Guardado localmente",
        description: "Se sincronizará cuando haya conexión",
      });
      return { success: true, online: false };
    }

    toast({
      title: "Error",
      description: "No se pudo guardar la calibración",
      variant: "destructive",
    });
    return { success: false, online: false };
  }, [isOnline, addToQueue, toast]);

  // Auto-save draft on interval
  const enableAutoSave = useCallback((
    id: string,
    getData: () => any,
    intervalMs: number = 30000 // 30 seconds
  ) => {
    const interval = setInterval(async () => {
      const data = getData();
      await saveDraft(id, data);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [saveDraft]);

  return {
    isOnline,
    saveDraft,
    loadLatestDraft,
    deleteDraft,
    cacheProfile,
    getCachedProfile,
    saveCalibration,
    enableAutoSave,
  };
}
