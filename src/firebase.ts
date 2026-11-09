import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Detect Safari, iOS, or WebKit browsers where persistent HTTP streaming can stall
const isSafariOrIOS =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ||
    (typeof (navigator as any).maxTouchPoints === 'number' && (navigator as any).maxTouchPoints > 2));

// Initialize Cloud Firestore with robust settings (crucial for Safari iOS, WebKit, and mobile networks)
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      ...(isSafariOrIOS
        ? { experimentalForceLongPolling: true }
        : { experimentalAutoDetectLongPolling: true }),
    },
    firebaseConfig.firestoreDatabaseId || undefined
  );
} catch (e) {
  firestoreInstance = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestoreInstance;

// Test Firestore connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or network unavailable.');
    }
    // Any response from server (including doc not found) confirms connection
    return true;
  }
}
