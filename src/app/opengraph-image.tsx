import { ImageResponse } from "next/og";
import { BingoGlyph } from "@/lib/cards/bingo-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 96px",
          background: "linear-gradient(135deg, #7c4dff 0%, #e60053 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              color: "#fff9f0",
              letterSpacing: "-2px",
            }}
          >
            Bingoal
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 36,
              color: "#fff9f0",
              maxWidth: 620,
            }}
          >
            Turn your goals & events into a bingo card
          </div>
        </div>
        <BingoGlyph size={320} background="#211b33" />
      </div>
    ),
    { ...size },
  );
}
