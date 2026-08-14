/**
 * Maximum length, in characters, allowed for a completion's note.
 *
 * Lives in its own module (rather than the "use server" actions file) so
 * both server-side validation and the client-side textarea/character limit
 * can import the same value — a `"use server"` file may only export async
 * functions, so a plain constant can't be exported from `actions.ts`.
 */
export const MAX_NOTE_LENGTH = 280;
