/** Small helper to read required server-only env vars with a clear error. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. See .env.example for setup.`);
  }
  return value;
}

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
