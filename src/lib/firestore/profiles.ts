import { db } from "@/lib/firebase/admin";

export interface Profile {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Creates or updates the `profiles/{uid}` doc from decoded auth claims. */
export async function upsertProfile(profile: Profile): Promise<void> {
  const now = new Date();
  const ref = db.collection("profiles").doc(profile.uid);
  const snapshot = await ref.get();

  await ref.set(
    {
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );
}
