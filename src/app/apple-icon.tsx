import { ImageResponse } from "next/og";
import { BingoGlyph } from "@/lib/cards/bingo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <BingoGlyph size={180} />
      </div>
    ),
    { ...size },
  );
}
