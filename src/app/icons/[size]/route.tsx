import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { BingoGlyph } from "@/lib/cards/bingo-mark";

export const dynamic = "force-static";

const VALID_SIZES = new Set([192, 512]);

export function generateStaticParams() {
  return Array.from(VALID_SIZES, (size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await params;
  const px = Number(sizeParam);
  if (!VALID_SIZES.has(px)) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#7c4dff",
        }}
      >
        <BingoGlyph size={px} />
      </div>
    ),
    { width: px, height: px },
  );
}
