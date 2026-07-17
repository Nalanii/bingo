import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { envServer } from "@/lib/env.server";

// Reuse a single Admin app across hot reloads / serverless invocations.
const globalForFirebaseAdmin = globalThis as unknown as {
  firebaseAdminApp: App | undefined;
};

const adminApp =
  globalForFirebaseAdmin.firebaseAdminApp ??
  initializeApp({
    credential: cert({
      projectId: envServer.firebaseAdmin.projectId,
      clientEmail: envServer.firebaseAdmin.clientEmail,
      privateKey: envServer.firebaseAdmin.privateKey,
    }),
  });

if (process.env.NODE_ENV !== "production" && getApps().length) {
  globalForFirebaseAdmin.firebaseAdminApp = adminApp;
}

/** Firebase Admin Auth instance — server-only. */
export const adminAuth = getAuth(adminApp);

/** Firestore instance accessed via the Admin SDK — server-only. */
export const db = getFirestore(adminApp);
