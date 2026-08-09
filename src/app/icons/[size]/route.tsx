import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { BingoBadge, BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";

export const dynamic = "force-static";

const VALID_SIZES = new Set([192, 512]);

export function generateStaticParams() {
  return Array.from(VALID_SIZES, (size) => ({ size: String(size) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const px = Number(sizeParam);
  if (!VALID_SIZES.has(px)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#171325",
      }}
    >
      <BingoGlyph size={px} background="#171325" />
      <BingoBadge size={px} />
    </div>,
    { width: px, height: px, fonts: await loadCardFonts() },
  );
}
