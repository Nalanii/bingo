/**
 * Constraints for a completion's attached photo, shared between the client
 * (pre-upload validation) and the server (authoritative validation) —
 * mirrors `completion-notes.ts`'s `MAX_NOTE_LENGTH`.
 */
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maps each accepted image MIME type to the file extension used in Storage. */
export const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Human-readable list for error messages and the file input's `accept` attribute. */
export const ALLOWED_PHOTO_TYPES_LABEL = "JPEG, PNG, WebP, or GIF";

export function isAllowedPhotoType(contentType: string): boolean {
  return contentType in ALLOWED_PHOTO_TYPES;
}
