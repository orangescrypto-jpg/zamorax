// lib/firebase/admin.ts
// Firebase Admin SDK — server-side only (API routes, middleware).
// Reads service account JSON from FIREBASE_SERVICE_ACCOUNT env var.

import * as admin from "firebase-admin"

function initAdmin(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT env var is missing. " +
      "Set it to the JSON string of your Firebase service account key.",
    )
  }

  let serviceAccount: admin.ServiceAccount
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error(
      "[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON. " +
      "Make sure you pasted the entire service account JSON as a single line.",
    )
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

export function getAdminAuth(): admin.auth.Auth {
  return initAdmin().auth()
}
