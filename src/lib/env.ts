/** Small helper to read required public env vars with a clear error. */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. See .env.example for setup.`,
    );
  }
  return value;
}

export const env = {
  firebase: {
    apiKey: required(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: required(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    appId: required(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
  },
  firebaseAdmin: {
    projectId: required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID),
    clientEmail: required(
      "FIREBASE_CLIENT_EMAIL",
      process.env.FIREBASE_CLIENT_EMAIL,
    ),
    // Vercel/`.env` files store literal "\n" in the private key; restore real newlines.
    privateKey: required(
      "FIREBASE_PRIVATE_KEY",
      process.env.FIREBASE_PRIVATE_KEY,
    ).replace(/\\n/g, "\n"),
  },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
