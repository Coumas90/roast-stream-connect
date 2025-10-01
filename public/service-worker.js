const CACHE_NAME = 'tupa-calibration-v1';
const RUNTIME_CACHE = 'tupa-runtime-v1';

// Resources to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/manifest.json',
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(cachesToDelete.map((cacheToDelete) => {
          return caches.delete(cacheToDelete);
        }));
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(RUNTIME_CACHE).then((cache) => {
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return cache.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If no cache, return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return cache.match('/index.html');
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
        });
    })
  );
});

// Background sync event - sync queued calibrations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-calibrations') {
    event.waitUntil(syncCalibrations());
  }
});

async function syncCalibrations() {
  try {
    // Get pending calibrations from IndexedDB
    const db = await openDB();
    const tx = db.transaction('offline-queue', 'readonly');
    const store = tx.objectStore('offline-queue');
    const pending = await getAll(store);

    // Send each to server
    for (const item of pending) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.data),
        });

        if (response.ok) {
          // Remove from queue on success
          const deleteTx = db.transaction('offline-queue', 'readwrite');
          await deleteTx.objectStore('offline-queue').delete(item.id);
        }
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
      }
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        pendingCount: pending.length,
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Helper functions for IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tupa-calibration-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-queue')) {
        db.createObjectStore('offline-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
