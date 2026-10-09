import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemData } from '../types';
import { getLocalSystemData, saveLocalSystemData } from './storage';

const SYSTEM_COLLECTION = 'system';
const APP_STATE_DOC = 'app_state';

/**
 * Fetch authoritative SystemData from either backend /api/data (which has direct Firestore access)
 * or client Firestore getDoc.
 */
export async function fetchAuthoritativeData(): Promise<SystemData | null> {
  // 1. Try server endpoint first (fastest and most reliable on Safari/iOS)
  try {
    const res = await fetch('/api/data', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (res.ok) {
      const serverData = (await res.json()) as SystemData;
      if (serverData && Array.isArray(serverData.batches) && Array.isArray(serverData.records)) {
        if (serverData.records.length > 0 || serverData.batches.length > 0 || serverData.passwordHash) {
          saveLocalSystemData(serverData);
          return serverData;
        }
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
        saveLocalSystemData(cloudData);
        return cloudData;
      }
    }
  } catch (err) {
    console.warn('Direct Firestore read failed:', err);
  }

  return null;
}

/**
 * Save complete SystemData to Firestore cloud database & server mirror
 */
export async function saveSystemDataToCloud(
  data: SystemData,
  options: { checkConflict?: boolean } = {}
): Promise<boolean> {
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);

    // Conflict protection: If saving from client, ensure we are not overwriting a much larger/newer cloud dataset
    if (options.checkConflict) {
      try {
        const existingSnap = await getDoc(docRef);
        if (existingSnap.exists()) {
          const existingData = existingSnap.data() as SystemData;
          // If cloud has more batches and this was not an explicit user reset (records === 0)
          if (
            existingData.batches &&
            data.batches &&
            data.batches.length < existingData.batches.length &&
            data.records.length > 0
          ) {
            console.warn(
              'Conflict detected: cloud has more batches than incoming update. Aborting accidental overwrite.'
            );
            return false;
          }
        }
      } catch (checkErr) {
        // Non-blocking
      }
    }

    const sanitizedData: SystemData = {
      batches: data.batches || [],
      records: data.records || [],
      configs: data.configs || {},
      passwordHash: data.passwordHash || '',
      viewPasswordHash: data.viewPasswordHash || '',
      viewPasswordEnabled: data.viewPasswordEnabled !== undefined ? data.viewPasswordEnabled : true,
      updatedAt: new Date().toISOString(),
    };

    // 1. Write to Firestore
    await setDoc(docRef, sanitizedData);

    // 2. Mirror to server backend API
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: sanitizedData }),
    }).catch(() => {});

    // 3. Persist locally as fast cache
    saveLocalSystemData(sanitizedData);
    return true;
  } catch (error) {
    console.error('Error saving data to Firebase Firestore:', error);
    // Even if client Firestore failed, try server /api/sync as fallback!
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
    } catch (_) {}

    saveLocalSystemData(data);
    return false;
  }
}

/**
 * Fetch SystemData once from Firestore cloud database
 */
export async function fetchSystemDataFromCloud(): Promise<SystemData | null> {
  return fetchAuthoritativeData();
}

/**
 * Real-time listener for cloud data updates.
 * Any update by admin on any device will instantly reflect to all connected users.
 */
export function subscribeToCloudSystemData(
  onUpdate: (data: SystemData) => void,
  onNotFound?: () => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data() as SystemData;
        if (cloudData && Array.isArray(cloudData.batches) && Array.isArray(cloudData.records)) {
          // Cache locally
          saveLocalSystemData(cloudData);
          onUpdate(cloudData);
        }
      } else {
        // Document does not exist: strictly invoke callback, NEVER write back stale local data!
        if (onNotFound) onNotFound();
      }
    },
    (error) => {
      console.warn('Firestore snapshot listener warning:', error);
      if (onError) onError(error);
    }
  );
}
