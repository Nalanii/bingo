import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env } from "@/lib/env";

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  appId: env.firebase.appId,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** Firebase Auth instance for use in Client Components. */
export const auth = getAuth(app);

/** Google-only auth provider. */
export const googleProvider = new GoogleAuthProvider();
