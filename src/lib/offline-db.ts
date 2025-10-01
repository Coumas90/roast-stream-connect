/**
 * IndexedDB utility for offline calibration data
 */

const DB_NAME = 'tupa-calibration-db';
const DB_VERSION = 1;

export interface OfflineQueueItem {
  id?: number;
  timestamp: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  data: any;
  retryCount: number;
}

export interface CachedProfile {
  id: string;
  data: any;
  timestamp: number;
}

export interface DraftCalibration {
  id: string;
  data: any;
  timestamp: number;
}

class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Offline queue store
        if (!db.objectStoreNames.contains('offline-queue')) {
          const queueStore = db.createObjectStore('offline-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Cached profiles store
        if (!db.objectStoreNames.contains('cached-profiles')) {
          const profileStore = db.createObjectStore('cached-profiles', { keyPath: 'id' });
          profileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Draft calibrations store
        if (!db.objectStoreNames.contains('draft-calibrations')) {
          const draftStore = db.createObjectStore('draft-calibrations', { keyPath: 'id' });
          draftStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // ===== Offline Queue Methods =====

  async addToQueue(item: Omit<OfflineQueueItem, 'id'>): Promise<number> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('offline-queue', 'readwrite');
      const store = tx.objectStore('offline-queue');
      const request = store.add(item);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as number);
    });
  }

  async getQueueItems(): Promise<OfflineQueueItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('offline-queue', 'readonly');
      const store = tx.objectStore('offline-queue');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removeFromQueue(id: number): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('offline-queue', 'readwrite');
      const store = tx.objectStore('offline-queue');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearQueue(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('offline-queue', 'readwrite');
      const store = tx.objectStore('offline-queue');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ===== Cached Profile Methods =====

  async cacheProfile(profile: CachedProfile): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cached-profiles', 'readwrite');
      const store = tx.objectStore('cached-profiles');
      const request = store.put(profile);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCachedProfile(id: string): Promise<CachedProfile | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cached-profiles', 'readonly');
      const store = tx.objectStore('cached-profiles');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllCachedProfiles(): Promise<CachedProfile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('cached-profiles', 'readonly');
      const store = tx.objectStore('cached-profiles');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // ===== Draft Calibration Methods =====

  async saveDraft(draft: DraftCalibration): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('draft-calibrations', 'readwrite');
      const store = tx.objectStore('draft-calibrations');
      const request = store.put(draft);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getDraft(id: string): Promise<DraftCalibration | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('draft-calibrations', 'readonly');
      const store = tx.objectStore('draft-calibrations');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getLatestDraft(): Promise<DraftCalibration | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('draft-calibrations', 'readonly');
      const store = tx.objectStore('draft-calibrations');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : null);
      };
    });
  }

  async deleteDraft(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('draft-calibrations', 'readwrite');
      const store = tx.objectStore('draft-calibrations');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllDrafts(): Promise<DraftCalibration[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('draft-calibrations', 'readonly');
      const store = tx.objectStore('draft-calibrations');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

export const offlineDB = new OfflineDB();
