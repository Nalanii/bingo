import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
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

/**
 * Downloads a completion photo and re-encodes it as a PNG data URI, resized
 * to a `size`x`size` square crop. Used by the export image (see GitHub issue
 * #64) instead of a signed URL: satori's rasterizer (resvg, bundled with
 * `next/og`) silently drops WebP `<img>` sources rather than erroring —
 * confirmed live, a WebP completion photo produced a valid PNG export with
 * that one thumbnail just missing, no error logged anywhere. Normalizing
 * every format to PNG here removes that dependency entirely, and avoids
 * satori needing to fetch the image itself over the network at render time.
 * Not used by the completion-history modal, which renders photos as normal
 * browser `<img>` tags — any format the browser itself supports is fine
 * there.
 */
export async function getCompletionPhotoDataUri(path: string, size: number): Promise<string> {
  const [buffer] = await bucket.file(path).download();
  const png = await sharp(buffer).resize(size, size, { fit: "cover" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
