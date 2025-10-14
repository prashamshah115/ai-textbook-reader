// ================================================================
// DAY 5: CANVAS CACHE - IndexedDB for rendered PDF pages
// ================================================================
// Caches rendered canvas bitmaps to make page turns instant (< 50ms)

import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'pdf-canvas-cache';
const DB_VERSION = 1;
const STORE_NAME = 'canvases';
const MAX_CACHE_SIZE_MB = 500; // 500MB limit

// ================================================================
// DATABASE SCHEMA
// ================================================================

interface CanvasCacheDB extends DBSchema {
  canvases: {
    key: string; // Format: `${textbookId}-${pageNumber}-${scale}`
    value: {
      textbookId: string;
      pageNumber: number;
      scale: number;
      imageData: Blob;
      size: number; // bytes
      createdAt: number; // timestamp
      accessedAt: number; // timestamp for LRU
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CanvasCacheDB>> | null = null;

// ================================================================
// DATABASE INITIALIZATION
// ================================================================

async function getDB(): Promise<IDBPDatabase<CanvasCacheDB>> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB<CanvasCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create canvas store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME);
        
        // Indexes for efficient queries
        store.createIndex('textbookId', 'textbookId');
        store.createIndex('accessedAt', 'accessedAt');
        store.createIndex('size', 'size');
      }
    },
  });

  return dbPromise;
}

// ================================================================
// CACHE KEY GENERATION
// ================================================================

function getCacheKey(textbookId: string, pageNumber: number, scale: number = 1): string {
  return `${textbookId}-${pageNumber}-${scale.toFixed(2)}`;
}

// ================================================================
// CACHE OPERATIONS
// ================================================================

/**
 * Get cached canvas for a page
 */
export async function getCachedCanvas(
  textbookId: string,
  pageNumber: number,
  scale: number = 1
): Promise<Blob | null> {
  try {
    const db = await getDB();
    const key = getCacheKey(textbookId, pageNumber, scale);
    const entry = await db.get(STORE_NAME, key);

    if (!entry) {
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    await db.put(STORE_NAME, entry, key);

    console.log(`[Canvas Cache] HIT - Page ${pageNumber} (${(entry.size / 1024).toFixed(1)}KB)`);
    return entry.imageData;
  } catch (error) {
    console.error('[Canvas Cache] Error getting cache:', error);
    return null;
  }
}

/**
 * Cache a rendered canvas
 */
export async function cacheCanvas(
  textbookId: string,
  pageNumber: number,
  imageBlob: Blob,
  scale: number = 1
): Promise<void> {
  try {
    const db = await getDB();
    const key = getCacheKey(textbookId, pageNumber, scale);
    const now = Date.now();

    // Check cache size before adding
    await enforceCacheSize(db);

    const entry = {
      textbookId,
      pageNumber,
      scale,
      imageData: imageBlob,
      size: imageBlob.size,
      createdAt: now,
      accessedAt: now,
    };

    await db.put(STORE_NAME, entry, key);
    
    console.log(`[Canvas Cache] STORED - Page ${pageNumber} (${(imageBlob.size / 1024).toFixed(1)}KB)`);
  } catch (error) {
    console.error('[Canvas Cache] Error caching:', error);
    // Non-critical - continue without cache
  }
}

/**
 * Check if a page is cached
 */
export async function isCached(
  textbookId: string,
  pageNumber: number,
  scale: number = 1
): Promise<boolean> {
  try {
    const db = await getDB();
    const key = getCacheKey(textbookId, pageNumber, scale);
    const entry = await db.get(STORE_NAME, key);
    return !!entry;
  } catch {
    return false;
  }
}

/**
 * Prefetch multiple pages in background
 */
export async function prefetchPages(
  textbookId: string,
  pageNumbers: number[],
  scale: number = 1,
  renderFn: (pageNum: number) => Promise<Blob>
): Promise<void> {
  console.log(`[Canvas Cache] Prefetching pages:`, pageNumbers);

  // Check which pages need prefetching
  const uncached = [];
  for (const pageNum of pageNumbers) {
    const cached = await isCached(textbookId, pageNum, scale);
    if (!cached) {
      uncached.push(pageNum);
    }
  }

  if (uncached.length === 0) {
    console.log('[Canvas Cache] All pages already cached');
    return;
  }

  // Render and cache in background (parallel)
  const prefetchPromises = uncached.map(async (pageNum) => {
    try {
      const blob = await renderFn(pageNum);
      await cacheCanvas(textbookId, pageNum, blob, scale);
    } catch (error) {
      console.error(`[Canvas Cache] Prefetch failed for page ${pageNum}:`, error);
    }
  });

  // Don't await - let it run in background
  Promise.all(prefetchPromises);
}

/**
 * Clear cache for a specific textbook
 */
export async function clearTextbookCache(textbookId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('textbookId');
    
    const keys = await index.getAllKeys(IDBKeyRange.only(textbookId));
    
    for (const key of keys) {
      await store.delete(key);
    }

    await tx.done;
    console.log(`[Canvas Cache] Cleared ${keys.length} cached pages for textbook ${textbookId}`);
  } catch (error) {
    console.error('[Canvas Cache] Error clearing cache:', error);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
    console.log('[Canvas Cache] Cleared all cached pages');
  } catch (error) {
    console.error('[Canvas Cache] Error clearing all cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  textbooks: Record<string, { pages: number; size: number }>;
}> {
  try {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);

    let totalSize = 0;
    const textbooks: Record<string, { pages: number; size: number }> = {};

    for (const entry of all) {
      totalSize += entry.size;

      if (!textbooks[entry.textbookId]) {
        textbooks[entry.textbookId] = { pages: 0, size: 0 };
      }

      textbooks[entry.textbookId].pages++;
      textbooks[entry.textbookId].size += entry.size;
    }

    return {
      totalEntries: all.length,
      totalSize,
      textbooks,
    };
  } catch (error) {
    console.error('[Canvas Cache] Error getting stats:', error);
    return { totalEntries: 0, totalSize: 0, textbooks: {} };
  }
}

/**
 * Enforce cache size limit using LRU eviction
 */
async function enforceCacheSize(db: IDBPDatabase<CanvasCacheDB>): Promise<void> {
  const MAX_SIZE = MAX_CACHE_SIZE_MB * 1024 * 1024; // Convert to bytes

  try {
    const all = await db.getAll(STORE_NAME);
    const totalSize = all.reduce((sum, entry) => sum + entry.size, 0);

    if (totalSize < MAX_SIZE) {
      return; // Within limit
    }

    console.log(
      `[Canvas Cache] Cache size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds limit, evicting...`
    );

    // Sort by least recently accessed (LRU)
    all.sort((a, b) => a.accessedAt - b.accessedAt);

    // Delete oldest entries until under limit
    let currentSize = totalSize;
    const tx = db.transaction(STORE_NAME, 'readwrite');

    for (const entry of all) {
      if (currentSize < MAX_SIZE * 0.9) break; // Target 90% of max

      const key = getCacheKey(entry.textbookId, entry.pageNumber, entry.scale);
      await tx.store.delete(key);
      currentSize -= entry.size;
      console.log(`[Canvas Cache] Evicted page ${entry.pageNumber} (LRU)`);
    }

    await tx.done;
  } catch (error) {
    console.error('[Canvas Cache] Error enforcing size:', error);
  }
}

// ================================================================
// EXPORT UTILITIES
// ================================================================

export const canvasCache = {
  get: getCachedCanvas,
  set: cacheCanvas,
  isCached,
  prefetch: prefetchPages,
  clear: clearTextbookCache,
  clearAll: clearAllCache,
  stats: getCacheStats,
};

