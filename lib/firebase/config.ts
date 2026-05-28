// lib/firebase/config.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

// Storage — imported normally but only used in "use client" components.
import { getStorage } from "firebase/storage";
export const storage = getStorage(app);

// Analytics — client-only, lazy initialised
export const getClientAnalytics = async () => {
  if (typeof window === "undefined") return null;
  const { getAnalytics } = await import("firebase/analytics");
  return getAnalytics(app);
};

// Messaging — client-only, lazy initialised
export const getClientMessaging = async () => {
  if (typeof window === "undefined") return null;
  const { getMessaging } = await import("firebase/messaging");
  return getMessaging(app);
};

export default app;
export { app };
