import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemData } from '../types';
import { getLocalSystemData, saveLocalSystemData } from './storage';

const SYSTEM_COLLECTION = 'system';
const APP_STATE_DOC = 'app_state';

/**
 * Fetch authoritative SystemData from backend /api/data with aggressive anti-cache parameters
 * (critical for Safari/WebKit cross-browser synchronization), with Firestore fallback.
 */
export async function fetchAuthoritativeData(): Promise<SystemData | null> {
  // 1. Try server endpoint first (fastest and most reliable on Safari/iOS)
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
        // Return server data directly without prematurely mutating localStorage
        return serverData;
      }
    }
  } catch (err) {
    console.warn('Fetch from /api/data failed, trying direct Firestore:', err);
  }

  // 2. Fall back to direct client Firestore read
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const cloudData = snap.data() as SystemData;
      if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
        return cloudData;
      }
    }
  } catch (err) {
    console.warn('Direct Firestore read failed:', err);
  }

  return null;
}

/**
 * Fetch lightweight server status for quick sync timestamp comparison
 */
export async function fetchServerStatus(): Promise<{
  lastImportTime: string;
  lastImportTimestamp: number;
  batchesCount: number;
  recordsCount: number;
} | null> {
  try {
    const res = await fetch('/api/status', {
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
 * Save complete SystemData to server mirror and Firestore cloud database.
 * Strictly forbidden in visitor browse mode.
 */
export async function saveSystemDataToCloud(
  data: SystemData,
  options: { force?: boolean } = {}
): Promise<SaveSystemResult> {
  // 浏览模式下，禁止向服务器端同步数据
  const currentRole = sessionStorage.getItem('auth_role');
  if (currentRole === 'view') {
    console.warn('浏览模式下禁止向服务器端同步数据');
    return { success: false, forbidden: true };
  }

  const sanitizedData: SystemData = {
    batches: data.batches || [],
    records: data.records || [],
    configs: data.configs || {},
    passwordHash: data.passwordHash || '',
    viewPasswordHash: data.viewPasswordHash || '',
    viewPasswordEnabled: data.viewPasswordEnabled !== undefined ? data.viewPasswordEnabled : true,
    updatedAt: data.updatedAt || new Date().toISOString(),
    lastImportTime: data.lastImportTime || '',
    lastImportTimestamp: data.lastImportTimestamp || 0,
  };

  // 1. First sync to server backend (authoritative on-disk store & seconds tracker)
  try {
    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-role': currentRole || 'manager',
      },
      body: JSON.stringify({
        data: sanitizedData,
        force: options.force === true,
        clientLastImportTimestamp: sanitizedData.lastImportTimestamp,
      }),
    });

    if (syncRes.status === 409) {
      // Conflict: Server has newer data! Prompt administrator
      const conflictPayload = await syncRes.json();
      return {
        success: false,
        conflict: true,
        serverData: conflictPayload.serverData,
        serverLastImportTime: conflictPayload.serverLastImportTime,
        serverLastImportTimestamp: conflictPayload.serverLastImportTimestamp,
      };
    }

    if (syncRes.status === 403) {
      return { success: false, forbidden: true };
    }

    if (syncRes.ok) {
      const syncJson = await syncRes.json();
      if (syncJson.data) {
        sanitizedData.lastImportTime = syncJson.data.lastImportTime;
        sanitizedData.lastImportTimestamp = syncJson.data.lastImportTimestamp;
      }
    }
  } catch (serverErr) {
    console.warn('Server sync error:', serverErr);
  }

  // 2. Persist locally
  saveLocalSystemData(sanitizedData);

  // 3. Mirror to Firestore asynchronously
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
    setDoc(docRef, sanitizedData).catch((e) => {
      console.warn('Direct Firestore async mirror failed:', e);
    });
  } catch (fsErr) {
    // Non-blocking
  }

  return { success: true };
}

/**
 * Fetch SystemData once from Firestore cloud database
 */
export async function fetchSystemDataFromCloud(): Promise<SystemData | null> {
  return fetchAuthoritativeData();
}

/**
 * Real-time listener for server and cloud data updates.
 * Leverages Server-Sent Events (SSE) for instant cross-tab / cross-browser sync,
 * with Firestore onSnapshot fallback.
 */
export function subscribeToCloudSystemData(
  onUpdate: (data: SystemData) => void,
  onNotFound?: () => void,
  onError?: (error: Error) => void
): Unsubscribe {
  let isUnsubscribed = false;
  let sseSource: EventSource | null = null;
  let pollTimer: any = null;

  // Real-time server sync via SSE
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      sseSource = new EventSource('/api/events');
      sseSource.addEventListener('data_update', async () => {
        if (isUnsubscribed) return;
        const fresh = await fetchAuthoritativeData();
        if (fresh && !isUnsubscribed) {
          onUpdate(fresh);
        }
      });
      sseSource.onerror = () => {
        // If SSE disconnects, fall back to low-frequency background poll
        if (!pollTimer && !isUnsubscribed) {
          pollTimer = setInterval(async () => {
            if (isUnsubscribed) return;
            const status = await fetchServerStatus();
            if (status) {
              const currentLocal = getLocalSystemData();
              const localTs = currentLocal.lastImportTimestamp || 0;
              if (status.lastImportTimestamp > localTs) {
                const fresh = await fetchAuthoritativeData();
                if (fresh && !isUnsubscribed) onUpdate(fresh);
              }
            }
          }, 4000);
        }
      };
      sseSource.onopen = () => {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
    } catch (e) {
      // Non-blocking
    }
  }

  // Fallback / complementary Firestore snapshot listener
  const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
  const unsubFs = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as SystemData;
        if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
          onUpdate(cloudData);
        }
      } else {
        if (onNotFound) onNotFound();
      }
    },
    (error) => {
      console.warn('Firestore snapshot listener warning:', error);
      if (onError) onError(error);
    }
  );

  return () => {
    isUnsubscribed = true;
    if (sseSource) sseSource.close();
    if (pollTimer) clearInterval(pollTimer);
    unsubFs();
  };
}
