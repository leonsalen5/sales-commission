import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemData } from '../types';
import { getLocalSystemData, saveLocalSystemData } from './storage';

const SYSTEM_COLLECTION = 'system';
const APP_STATE_DOC = 'app_state';

/**
 * Save complete SystemData to Firestore cloud database
 */
export async function saveSystemDataToCloud(data: SystemData): Promise<boolean> {
  try {
    const docRef = doc(db, SYSTEM_COLLECTION, APP_STATE_DOC);
    // Sanitize data (ensure no undefined values for Firestore)
    const sanitizedData: SystemData = {
      batches: data.batches || [],
      records: data.records || [],
      configs: data.configs || {},
      passwordHash: data.passwordHash || '',
    };

    await setDoc(docRef, {
      ...sanitizedData,
      updatedAt: new Date().toISOString(),
    });

    // Also persist locally as fast cache
    saveLocalSystemData(data);
    return true;
  } catch (error) {
    console.error('Error saving data to Firebase Firestore:', error);
    // Still save locally
    saveLocalSystemData(data);
    return false;
  }
}

/**
 * Fetch SystemData once from Firestore cloud database
 */
export async function fetchSystemDataFromCloud(): Promise<SystemData | null> {
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
    return null;
  } catch (error) {
    console.error('Error fetching data from Firebase Firestore:', error);
    return null;
  }
}

/**
 * Real-time listener for cloud data updates.
 * Any update by admin on any device will instantly reflect to all connected users.
 */
export function subscribeToCloudSystemData(
  onUpdate: (data: SystemData) => void,
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
      }
    },
    (error) => {
      console.warn('Firestore snapshot listener warning:', error);
      if (onError) onError(error);
    }
  );
}
