/** Small helper to read required env vars with a clear error. */
export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. See .env.example for setup.`);
  }
  return value;
}
