// lib/firebase/admin.ts
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

function initAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        projectId:   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }),
    })
  }
  return getApp()
}

export function getAdminDb() {
  return getFirestore(initAdmin())
}

export const adminAuth = getAuth(initAdmin())
