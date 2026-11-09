import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore
const isBrowser = typeof window !== 'undefined';

let firestoreInstance;
try {
  firestoreInstance = isBrowser
    ? initializeFirestore(
        app,
        {
          ignoreUndefinedProperties: true,
          experimentalAutoDetectLongPolling: true,
          experimentalLongPollingOptions: {
            timeoutSeconds: 15,
          },
        },
        firebaseConfig.firestoreDatabaseId || undefined
      )
    : (firebaseConfig.firestoreDatabaseId
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app));
} catch (e) {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

// Test Firestore connection on boot with safety timeout
export async function testConnection(): Promise<boolean> {
  try {
    const testPromise = getDocFromServer(doc(db, '_connection_test_', 'ping'));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );
    await Promise.race([testPromise, timeoutPromise]);
    return true;
  } catch (error) {
    return false;
  }
}
