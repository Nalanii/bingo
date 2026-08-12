import type { Metadata } from "next";
import { getOwnedCardOrNotFound } from "@/lib/cards/access";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = await getOwnedCardOrNotFound(id);
  return { title: `${card.name} — export` };
}

/**
 * A real app page (not a raw image response) wrapping the export-image PNG —
 * so opening it in a new tab shows the site's favicon/title like any other
 * page, and the browser's native image viewer (right-click to save/copy)
 * handles the rest. See GitHub issue #60.
 */
export default async function ExportImagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getOwnedCardOrNotFound(id);

  return (
    <div className="flex justify-center py-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- this is a
          generated, per-request PNG from our own route handler, not a static
          asset next/image's optimizer would help with. */}
      <img
        src={`/dashboard/cards/${id}/export-image/image`}
        alt={`${card.name} bingo card`}
        className="w-full max-w-xl rounded-[var(--radius-lg)] shadow-lg"
      />
    </div>
  );
}
