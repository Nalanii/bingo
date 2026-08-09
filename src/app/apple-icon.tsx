import { ImageResponse } from "next/og";
import { BingoBadge, BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
      <BingoGlyph size={180} background="#171325" />
      <BingoBadge size={180} />
    </div>,
    { ...size, fonts: await loadCardFonts() },
  );
}
