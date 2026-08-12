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
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <p className="text-muted-foreground max-w-sm text-sm">
        Right-click (or press and hold) the image below to save, copy, or share it.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- this is a
          generated, per-request PNG from our own route handler, not a static
          asset next/image's optimizer would help with. */}
      <img
        src={`/dashboard/cards/${id}/export-image/image`}
        alt={`${card.name} bingo card`}
        // The image's own background is near-black, same as this page's —
        // without a visible border it has no edge to see against the page.
        className="border-control-border w-full max-w-xl rounded-[var(--radius-lg)] border-2 shadow-lg"
      />
    </div>
  );
}
