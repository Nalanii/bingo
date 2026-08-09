import { ImageResponse } from "next/og";
import { BingoBadge, BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Concentric rings fake a soft blurred glow — satori doesn't render
// filter: blur or box-shadow blur, and a plain radial-gradient div leaves a
// hard seam at its own box edge, so this is the reliable option: layered
// solid-color circles, each bigger and fainter, sharing one center.
// Many thin steps on a quadratic curve keep individual bands imperceptible.
//
// Satori also doesn't support the `right`/`bottom` CSS properties (they're
// silently dropped, collapsing to 0/0), and a box whose *right or bottom*
// edge exceeds the canvas gets clipped or dropped outright — unlike the
// top/left edges, which happily allow negative offsets. So an orb can only
// bleed off the top-left; anywhere else it needs a small enough radius to
// stay fully inside the canvas.
function buildRingSteps(maxRadius: number, minRadius: number, peakOpacity: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1); // 0 = outermost, 1 = innermost
    return {
      radius: maxRadius - t * (maxRadius - minRadius),
      opacity: peakOpacity * t * t,
    };
  });
}

function Orb({
  cx,
  cy,
  color,
  maxRadius = 360,
  minRadius = 16,
  peakOpacity = 0.02,
}: {
  cx: number;
  cy: number;
  color: string;
  maxRadius?: number;
  minRadius?: number;
  peakOpacity?: number;
}) {
  const steps = buildRingSteps(maxRadius, minRadius, peakOpacity, 90);
  return (
    <>
      {steps.map(({ radius, opacity }, i) => (
        <div
          key={`${cx}-${cy}-${color}-${i}`}
          style={{
            position: "absolute",
            top: cy - radius,
            left: cx - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: "50%",
            background: color,
            opacity,
            display: "flex",
          }}
        />
      ))}
    </>
  );
}

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 96px",
        background: "#171325",
        fontFamily: "Nunito",
        overflow: "hidden",
      }}
    >
      {/* playful background orbs, echoing the landing page's blobs */}
      <Orb cx={-60} cy={-60} color="#ffdd6b" />
      <Orb cx={935} cy={370} color="#9b7bff" maxRadius={260} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Fredoka",
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
      <div style={{ position: "relative", display: "flex" }}>
        <BingoGlyph size={320} />
        <BingoBadge size={320} />
      </div>
    </div>,
    { ...size, fonts: await loadCardFonts() },
  );
}
