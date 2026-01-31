import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import type { Incident } from './apiService';
import * as apiService from './apiService';

// Storage keys
const CACHE_PREFIX = '@oncallshift/cache/';
const SYNC_QUEUE_KEY = '@oncallshift/sync_queue';
const CACHE_METADATA_KEY = '@oncallshift/cache_metadata';

// Cache expiration times (in milliseconds)
const CACHE_TTL = {
  incidents: 5 * 60 * 1000, // 5 minutes
  oncall: 10 * 60 * 1000, // 10 minutes
  services: 30 * 60 * 1000, // 30 minutes
  users: 30 * 60 * 1000, // 30 minutes
  profile: 60 * 60 * 1000, // 1 hour
};

// Network check interval
const NETWORK_CHECK_INTERVAL = 30000; // 30 seconds

export type CacheKey = keyof typeof CACHE_TTL;

export interface CacheMetadata {
  [key: string]: {
    cachedAt: number;
    ttl: number;
  };
}

export interface SyncQueueItem {
  id: string;
  action: 'acknowledge' | 'resolve' | 'addNote' | 'reassign' | 'escalate';
  incidentId: string;
  payload?: any;
  createdAt: number;
  retryCount: number;
}

export interface OfflineStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  pendingActions: number;
}

// State
let isConnected = true;
let syncQueueListeners: ((queue: SyncQueueItem[]) => void)[] = [];
let connectionListeners: ((status: OfflineStatus) => void)[] = [];
let networkCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check network connectivity using fetch
 */
async function checkNetworkState(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    const wasConnected = isConnected;
    isConnected = true;

    if (wasConnected !== isConnected) {
      notifyConnectionListeners();
      if (!wasConnected && isConnected) {
        processSyncQueue();
      }
    }
  } catch (error) {
    const wasConnected = isConnected;
    isConnected = false;

    if (wasConnected !== isConnected) {
      notifyConnectionListeners();
    }
  }
}

/**
 * Initialize offline service
 */
export async function initOfflineService(): Promise<void> {
  // Check initial state
  await checkNetworkState();

  // Set up periodic network checks
  if (!networkCheckInterval) {
    networkCheckInterval = setInterval(checkNetworkState, NETWORK_CHECK_INTERVAL);
  }

  // Listen for app state changes to sync when coming to foreground
  AppState.addEventListener('change', handleAppStateChange);

  // Process any pending sync items
  await processSyncQueue();
}

/**
 * Handle app state changes
 */
function handleAppStateChange(nextAppState: AppStateStatus): void {
  if (nextAppState === 'active') {
    // Check network when app comes to foreground
    checkNetworkState();
  }
}

/**
 * Get current offline status
 */
export async function getOfflineStatus(): Promise<OfflineStatus> {
  const queue = await getSyncQueue();
  await checkNetworkState();

  return {
    isConnected,
    isInternetReachable: isConnected,
    pendingActions: queue.length,
  };
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
  return isConnected;
}

// ============ CACHING ============

/**
 * Get cached data
 */
export async function getCached<T>(key: CacheKey, subKey?: string): Promise<T | null> {
  try {
    const cacheKey = subKey ? `${CACHE_PREFIX}${key}/${subKey}` : `${CACHE_PREFIX}${key}`;
    const [dataStr, metadataStr] = await Promise.all([
      AsyncStorage.getItem(cacheKey),
      AsyncStorage.getItem(CACHE_METADATA_KEY),
    ]);

    if (!dataStr) return null;

    // Check if expired
    const metadata: CacheMetadata = metadataStr ? JSON.parse(metadataStr) : {};
    const itemMeta = metadata[cacheKey];

    if (itemMeta) {
      const now = Date.now();
      if (now - itemMeta.cachedAt > itemMeta.ttl) {
        // Cache expired
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
    }

    return JSON.parse(dataStr);
  } catch (error) {
    return null;
  }
}

/**
 * Set cached data
 */
export async function setCache<T>(key: CacheKey, data: T, subKey?: string): Promise<void> {
  try {
    const cacheKey = subKey ? `${CACHE_PREFIX}${key}/${subKey}` : `${CACHE_PREFIX}${key}`;
    const ttl = CACHE_TTL[key];

    // Update metadata
    const metadataStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    const metadata: CacheMetadata = metadataStr ? JSON.parse(metadataStr) : {};

    metadata[cacheKey] = {
      cachedAt: Date.now(),
      ttl,
    };

    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(data)),
      AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata)),
    ]);
  } catch (error) {
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove([...cacheKeys, CACHE_METADATA_KEY]);
  } catch (error) {
  }
}

/**
 * Get data with cache fallback
 */
export async function getWithCache<T>(
  key: CacheKey,
  fetcher: () => Promise<T>,
  subKey?: string
): Promise<T> {
  // Try to fetch fresh data if online
  if (isConnected) {
    try {
      const data = await fetcher();
      await setCache(key, data, subKey);
      return data;
    } catch (error) {
    }
  }

  // Fall back to cache
  const cached = await getCached<T>(key, subKey);
  if (cached !== null) {
    return cached;
  }

  // No cache, throw error
  throw new Error('No cached data available and offline');
}

// ============ SYNC QUEUE ============

/**
 * Get sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  action: SyncQueueItem['action'],
  incidentId: string,
  payload?: any
): Promise<void> {
  try {
    const queue = await getSyncQueue();

    const item: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      incidentId,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };

    queue.push(item);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

    // Notify listeners
    notifySyncQueueListeners(queue);

    // Try to process immediately if online
    if (isConnected) {
      processSyncQueue();
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Remove item from sync queue
 */
async function removeFromSyncQueue(id: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const newQueue = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(newQueue));
    notifySyncQueueListeners(newQueue);
  } catch (error) {
  }
}

/**
 * Update item retry count
 */
async function updateRetryCount(id: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const item = queue.find(i => i.id === id);
    if (item) {
      item.retryCount++;
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
  }
}

/**
 * Process sync queue
 */
export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  if (!isConnected) {
    return { processed: 0, failed: 0 };
  }

  const queue = await getSyncQueue();
  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    // Skip items that have failed too many times
    if (item.retryCount >= 3) {
      failed++;
      continue;
    }

    try {
      await processQueueItem(item);
      await removeFromSyncQueue(item.id);
      processed++;
    } catch (error) {
      await updateRetryCount(item.id);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Process a single queue item
 */
async function processQueueItem(item: SyncQueueItem): Promise<void> {
  switch (item.action) {
    case 'acknowledge':
      await apiService.acknowledgeIncident(item.incidentId);
      break;
    case 'resolve':
      await apiService.resolveIncident(item.incidentId, item.payload?.resolution);
      break;
    case 'addNote':
      await apiService.addIncidentNote(item.incidentId, item.payload?.content);
      break;
    case 'reassign':
      await apiService.reassignIncident(item.incidentId, item.payload?.userId);
      break;
    case 'escalate':
      await apiService.escalateIncident(item.incidentId);
      break;
    default:
      throw new Error(`Unknown action: ${item.action}`);
  }
}

/**
 * Clear sync queue (use with caution)
 */
export async function clearSyncQueue(): Promise<void> {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
  notifySyncQueueListeners([]);
}

// ============ OFFLINE ACTIONS ============

/**
 * Acknowledge incident (with offline support)
 */
export async function acknowledgeIncidentOffline(incidentId: string): Promise<void> {
  if (isConnected) {
    try {
      await apiService.acknowledgeIncident(incidentId);
      return;
    } catch (error) {
    }
  }

  await addToSyncQueue('acknowledge', incidentId);
}

/**
 * Resolve incident (with offline support)
 */
export async function resolveIncidentOffline(incidentId: string, resolution?: string): Promise<void> {
  if (isConnected) {
    try {
      await apiService.resolveIncident(incidentId, resolution);
      return;
    } catch (error) {
    }
  }

  await addToSyncQueue('resolve', incidentId, { resolution });
}

/**
 * Add note to incident (with offline support)
 */
export async function addNoteOffline(incidentId: string, content: string): Promise<void> {
  if (isConnected) {
    try {
      await apiService.addIncidentNote(incidentId, content);
      return;
    } catch (error) {
    }
  }

  await addToSyncQueue('addNote', incidentId, { content });
}

// ============ LISTENERS ============

/**
 * Subscribe to sync queue changes
 */
export function addSyncQueueListener(listener: (queue: SyncQueueItem[]) => void): () => void {
  syncQueueListeners.push(listener);
  return () => {
    syncQueueListeners = syncQueueListeners.filter(l => l !== listener);
  };
}

/**
 * Subscribe to connection status changes
 */
export function addConnectionListener(listener: (status: OfflineStatus) => void): () => void {
  connectionListeners.push(listener);
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
}

/**
 * Notify sync queue listeners
 */
function notifySyncQueueListeners(queue: SyncQueueItem[]): void {
  syncQueueListeners.forEach(listener => listener(queue));
}

/**
 * Notify connection listeners
 */
async function notifyConnectionListeners(): Promise<void> {
  const status = await getOfflineStatus();
  connectionListeners.forEach(listener => listener(status));
}

// ============ CACHED API FUNCTIONS ============

/**
 * Get incidents with cache
 */
export async function getIncidentsCached(
  status: 'triggered' | 'acknowledged' | 'resolved'
): Promise<Incident[]> {
  return getWithCache(
    'incidents',
    () => apiService.getIncidents(status),
    status
  );
}

/**
 * Get on-call data with cache
 */
export async function getOnCallDataCached() {
  return getWithCache('oncall', () => apiService.getOnCallData());
}

/**
 * Get services with cache
 */
export async function getServicesCached() {
  return getWithCache('services', () => apiService.getServices());
}

/**
 * Get user profile with cache
 */
export async function getUserProfileCached() {
  return getWithCache('profile', () => apiService.getUserProfile());
}
