import { required } from "./env-shared";

export const envServer = {
  firebaseAdmin: {
    projectId: required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
    clientEmail: required("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL),
    // Vercel/`.env` files store literal "\n" in the private key; restore real newlines.
    privateKey: required("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY).replace(
      /\\n/g,
      "\n",
    ),
  },
};
