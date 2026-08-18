import { getStorage } from "firebase-admin/storage";
import { adminApp } from "@/lib/firebase/admin";
import { ALLOWED_PHOTO_TYPES } from "@/lib/completion-photos";

/** The app's default Storage bucket — server-only. */
const bucket = getStorage(adminApp).bucket();

/** Signed URLs are regenerated on every completion-history fetch, so a short window is fine. */
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Builds the Storage object path for a completion's photo. `contentType` must be an allowed type. */
export function completionPhotoPath(
  cardId: string,
  completionId: string,
  contentType: string,
): string {
  const extension = ALLOWED_PHOTO_TYPES[contentType];
  return `completion-photos/${cardId}/${completionId}.${extension}`;
}

/** Uploads (or overwrites) a completion photo at the given path. */
export async function uploadCompletionPhoto(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await bucket.file(path).save(buffer, { contentType });
}

/** Deletes a completion photo, silently succeeding if it's already gone. */
export async function deleteCompletionPhoto(path: string): Promise<void> {
  await bucket.file(path).delete({ ignoreNotFound: true });
}

/** Generates a time-limited signed URL for reading a completion photo. */
export async function getCompletionPhotoSignedUrl(path: string): Promise<string> {
  const [url] = await bucket.file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return url;
}
