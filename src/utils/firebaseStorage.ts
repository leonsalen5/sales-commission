import { doc, getDocFromServer, runTransaction, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemData, SalesRecord, SalespersonRole, ImportBatch, SalespersonConfig } from '../types';
import { getLocalSystemData, saveLocalSystemData, formatTimestampToSeconds, getCurrentTimestampSeconds } from './storage';

const SYSTEM_COLLECTION = 'system';
const APP_STATE_DOC = 'app_state';

function isServerAvailable(): boolean {
  // If running on static hosting (e.g. GitHub Pages: github.io), server /api does not exist.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('github.io') || host.includes('pages.dev')) {
      return false;
    }
  }
  return true;
}

/**
 * Fetch authoritative SystemData:
 * 1. If backend exists, fetch from /api/data.
 * 2. If static hosting (GitHub Pages) or /api/data fails, read directly from Firestore via getDocFromServer.
 */
export async function fetchAuthoritativeData(): Promise<SystemData | null> {
  // 1. Try server endpoint if server might exist
  if (isServerAvailable()) {
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
      // Server failed, seamlessly proceed to direct Firestore
    }
  }

  // 2. Direct Firestore reading: bypasses browser IndexedDB cache
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
    console.warn('Direct Firestore server read fallback:', err);
  }

  // Fallback to local memory data if completely offline
  return getLocalSystemData();
}

/**
 * Perform an atomic transaction mutation on Firestore app_state.
 * Ensures multi-user concurrency and prevents stale overwrites!
 */
export async function mutateFirestoreAppState(
  mutationFn: (current: SystemData) => SystemData
): Promise<SystemData> {
  const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    let currentData: SystemData;
    if (snap.exists()) {
      currentData = snap.data() as SystemData;
    } else {
      currentData = {
        batches: [],
        records: [],
        configs: {},
        viewPasswordEnabled: true,
        lastImportTime: '',
        lastImportTimestamp: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextData = mutationFn(currentData);
    // Maintain mandatory fields
    const nowSeconds = getCurrentTimestampSeconds();
    const nowFormatted = formatTimestampToSeconds();

    const finalizedData: SystemData = {
      batches: nextData.batches || [],
      records: nextData.records || [],
      configs: nextData.configs || {},
      passwordHash: nextData.passwordHash ?? currentData.passwordHash,
      viewPasswordHash: nextData.viewPasswordHash ?? currentData.viewPasswordHash,
      viewPasswordEnabled: nextData.viewPasswordEnabled !== undefined ? nextData.viewPasswordEnabled : currentData.viewPasswordEnabled,
      updatedAt: new Date().toISOString(),
      lastImportTime: nextData.lastImportTime || currentData.lastImportTime || nowFormatted,
      lastImportTimestamp: Math.max(
        nextData.lastImportTimestamp || 0,
        currentData.lastImportTimestamp || 0,
        nowSeconds
      ),
    };

    transaction.set(docRef, finalizedData);
    return finalizedData;
  });

  saveLocalSystemData(result);
  return result;
}

// Direct Firestore Atomic Mutators used when running statically or when /api is unavailable

export async function firestoreImportData(
  month: string,
  fileName: string,
  records: SalesRecord[]
): Promise<SystemData> {
  return mutateFirestoreAppState((current) => {
    const nowFormatted = formatTimestampToSeconds();
    const nowSeconds = getCurrentTimestampSeconds();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newBatch: ImportBatch = {
      id: batchId,
      month,
      fileName,
      uploadedAt: nowFormatted,
      uploadedTimestamp: nowSeconds,
      recordCount: records.length,
      totalAmount: records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    };

    const newRecords: SalesRecord[] = records.map((r, idx) => ({
      ...r,
      id: r.id || `rec_${batchId}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      batchId,
      month: r.month || month,
    }));

    return {
      ...current,
      batches: [newBatch, ...(current.batches || [])],
      records: [...(current.records || []), ...newRecords],
      lastImportTime: nowFormatted,
      lastImportTimestamp: nowSeconds,
    };
  });
}

export async function firestoreDeleteBatch(batchId: string): Promise<SystemData> {
  return mutateFirestoreAppState((current) => {
    return {
      ...current,
      batches: (current.batches || []).filter((b) => b.id !== batchId),
      records: (current.records || []).filter((r) => r.batchId !== batchId),
    };
  });
}

export async function firestoreUpdateRecord(record: SalesRecord): Promise<SystemData> {
  return mutateFirestoreAppState((current) => {
    return {
      ...current,
      records: (current.records || []).map((r) => (r.id === record.id ? record : r)),
    };
  });
}

export async function firestoreDeleteRecord(recordId: string): Promise<SystemData> {
  return mutateFirestoreAppState((current) => {
    return {
      ...current,
      records: (current.records || []).filter((r) => r.id !== recordId),
    };
  });
}

export async function firestoreUpdateConfig(params: {
  salesperson: string;
  role?: SalespersonRole;
  month?: string;
  otherAmount?: number;
  customNewRate?: number | null;
}): Promise<SystemData> {
  return mutateFirestoreAppState((current) => {
    const configs: Record<string, SalespersonConfig> = { ...(current.configs || {}) };
    const cur = configs[params.salesperson] || {
      salesperson: params.salesperson,
      role: '普通课程顾问',
      otherAmountByMonth: {},
    };

    const updated: SalespersonConfig = {
      ...cur,
      role: params.role || cur.role,
      customNewRate: params.customNewRate !== undefined ? (params.customNewRate ?? undefined) : cur.customNewRate,
      otherAmountByMonth: { ...(cur.otherAmountByMonth || {}) },
    };

    if (params.month && params.otherAmount !== undefined) {
      if (!updated.otherAmountByMonth) updated.otherAmountByMonth = {};
      updated.otherAmountByMonth[params.month] = params.otherAmount;
    }

    configs[params.salesperson] = updated;
    return {
      ...current,
      configs,
    };
  });
}

export async function firestoreSetPassword(passwordHash: string): Promise<SystemData> {
  return mutateFirestoreAppState((current) => ({
    ...current,
    passwordHash,
  }));
}

export async function firestoreSetViewPassword(
  viewPasswordHash: string,
  enabled: boolean = true
): Promise<SystemData> {
  return mutateFirestoreAppState((current) => ({
    ...current,
    viewPasswordHash,
    viewPasswordEnabled: enabled,
  }));
}

export async function firestoreResetData(): Promise<SystemData> {
  return mutateFirestoreAppState((current) => ({
    batches: [],
    records: [],
    configs: {},
    passwordHash: current.passwordHash,
    viewPasswordHash: current.viewPasswordHash,
    viewPasswordEnabled: current.viewPasswordEnabled,
    lastImportTime: '',
    lastImportTimestamp: 0,
    updatedAt: new Date().toISOString(),
  }));
}

export type Unsubscribe = () => void;

/**
 * Real-time listener for server and cloud authoritative data updates:
 * - Listens to direct Firestore onSnapshot doc updates (works on GitHub Pages & mobile Safari seamlessly!)
 * - If running with Node.js backend, also connects to SSE /api/events for microsecond local updates.
 */
export function subscribeToCloudSystemData(
  onUpdate: (data: SystemData) => void,
  _onNotFound?: () => void,
  _onError?: (error: Error) => void
): Unsubscribe {
  let isUnsubscribed = false;
  let sseSource: EventSource | null = null;
  let unsubscribeFirestore: (() => void) | null = null;

  // 1. Direct Firestore realtime listener (Reliable across all hosts: GitHub Pages, Cloud Run, Local)
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snapshot) => {
        if (isUnsubscribed) return;
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as SystemData;
          if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
            saveLocalSystemData(cloudData);
            onUpdate(cloudData);
          }
        }
      },
      (err) => {
        console.warn('Firestore onSnapshot notice:', err);
      }
    );
  } catch (err) {
    console.warn('Could not register Firestore listener:', err);
  }

  // 2. Server-Sent Events (SSE) listener if backend is running
  if (isServerAvailable() && typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
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
        // SSE error on static host is completely normal, silence it
      };
    } catch (e) {
      // ignore
    }
  }

  return () => {
    isUnsubscribed = true;
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (sseSource) sseSource.close();
  };
}
