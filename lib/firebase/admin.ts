// lib/firebase/admin.ts
// Firebase Admin SDK — server-side only (API routes, middleware).
// Reads service account JSON from FIREBASE_SERVICE_ACCOUNT env var.
//
// firebase-admin v14 removed the legacy `admin.app.App` / `app.auth()`
// namespace entirely (not just deprecated it), so this uses the modular
// API: initializeApp/getApps from "firebase-admin/app", getAuth from
// "firebase-admin/auth".

import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"

function initAdmin(): App {
  const existing = getApps()
  if (existing.length) return existing[0]!

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT env var is missing. " +
      "Set it to the JSON string of your Firebase service account key.",
    )
  }

  let serviceAccount: ServiceAccount
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON. " +
      "Make sure you pasted the entire service account JSON as a single line.",
    )
  }

  return initializeApp({
    credential: cert(serviceAccount),
  })
}

export function getAdminAuth(): Auth {
  return getAuth(initAdmin())
}
