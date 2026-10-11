import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemData } from '../types';
import { getLocalSystemData, saveLocalSystemData } from './storage';

const SYSTEM_COLLECTION = 'system';
const APP_STATE_DOC = 'app_state';

/**
 * Fetch authoritative SystemData from backend /api/data with aggressive anti-cache parameters
 * (critical for Safari/WebKit cross-browser synchronization), with direct server Firestore fallback.
 */
export async function fetchAuthoritativeData(): Promise<SystemData | null> {
  // 1. Primary: Server endpoint (fastest, guaranteed fresh, no client IndexedDB cache issues)
  try {
    const res = await fetch(`/api/data?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (res.ok) {
      const serverData = (await res.json()) as SystemData;
      if (serverData && Array.isArray(serverData.batches) && Array.isArray(serverData.records)) {
        saveLocalSystemData(serverData);
        return serverData;
      }
    }
  } catch (err) {
    console.warn('Fetch from /api/data failed, trying direct Firestore server read:', err);
  }

  // 2. Direct Firestore fallback: MUST use getDocFromServer to completely bypass browser IndexedDB cache
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
    const snap = await getDocFromServer(docRef);
    if (snap.exists()) {
      const cloudData = snap.data() as SystemData;
      if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
        saveLocalSystemData(cloudData);
        return cloudData;
      }
    }
  } catch (err) {
    console.warn('Direct Firestore server read failed:', err);
  }

  // Fallback to local memory data if completely offline
  return getLocalSystemData();
}

/**
 * Fetch lightweight server status for quick sync timestamp comparison
 */
export async function fetchServerStatus(): Promise<{
  lastImportTime: string;
  lastImportTimestamp: number;
  updatedAt: string;
  batchesCount: number;
  recordsCount: number;
} | null> {
  try {
    const res = await fetch(`/api/status?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // silent
  }
  return null;
}

export interface SaveSystemResult {
  success: boolean;
  conflict?: boolean;
  forbidden?: boolean;
  serverData?: SystemData;
  serverLastImportTime?: string;
  serverLastImportTimestamp?: number;
}

/**
 * DEPRECATED: Client整库写回已彻底废弃。
 * 所有数据变更均已重构为原子性服务端API（/api/import, /api/batches, /api/records等）。
 * 保留此方法仅作为兼容性签名，防止老代码报错，绝不将客户端本地旧状态写回覆盖服务端！
 */
export async function saveSystemDataToCloud(
  _data: SystemData,
  _options: { force?: boolean } = {}
): Promise<SaveSystemResult> {
  console.warn('saveSystemDataToCloud is deprecated: client full-state overwriting has been disabled for safety.');
  return { success: true };
}

/**
 * Fetch SystemData once
 */
export async function fetchSystemDataFromCloud(): Promise<SystemData | null> {
  return fetchAuthoritativeData();
}

export type Unsubscribe = () => void;

/**
 * Real-time listener for server authoritative data updates.
 * Leverages Server-Sent Events (SSE) with robust polling fallback.
 * Strictly avoids client-side Firestore IndexedDB onSnapshot to prevent WebKit stale cache bugs.
 */
export function subscribeToCloudSystemData(
  onUpdate: (data: SystemData) => void,
  _onNotFound?: () => void,
  _onError?: (error: Error) => void
): Unsubscribe {
  let isUnsubscribed = false;
  let sseSource: EventSource | null = null;
  let pollTimer: any = null;
  let lastKnownUpdatedAt = '';

  const checkAndUpdate = async () => {
    if (isUnsubscribed) return;
    try {
      const status = await fetchServerStatus();
      if (status && status.updatedAt && status.updatedAt !== lastKnownUpdatedAt) {
        lastKnownUpdatedAt = status.updatedAt;
        const fresh = await fetchAuthoritativeData();
        if (fresh && !isUnsubscribed) {
          onUpdate(fresh);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // 1. Real-time server sync via SSE
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      sseSource = new EventSource('/api/events');
      sseSource.addEventListener('data_update', async () => {
        if (isUnsubscribed) return;
        const fresh = await fetchAuthoritativeData();
        if (fresh && !isUnsubscribed) {
          if (fresh.updatedAt) lastKnownUpdatedAt = fresh.updatedAt;
          onUpdate(fresh);
        }
      });
      sseSource.onerror = () => {
        // SSE temporary disconnect, activate fallback polling
        if (!pollTimer && !isUnsubscribed) {
          pollTimer = setInterval(checkAndUpdate, 4000);
        }
      };
      sseSource.onopen = () => {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
    } catch (e) {
      // fallback to polling
      pollTimer = setInterval(checkAndUpdate, 5000);
    }
  } else {
    pollTimer = setInterval(checkAndUpdate, 5000);
  }

  // Periodic heartbeat poll (every 10 seconds) to ensure eventual consistency
  const heartbeatTimer = setInterval(checkAndUpdate, 10000);

  return () => {
    isUnsubscribed = true;
    if (sseSource) sseSource.close();
    if (pollTimer) clearInterval(pollTimer);
    clearInterval(heartbeatTimer);
  };
}
