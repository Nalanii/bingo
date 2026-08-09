import { readFile } from "node:fs/promises";
import path from "node:path";

const CELL = "#fff9f0";
// Bingoal's dark-mode brand tokens (--primary, --secondary, --accent, --success
// in src/app/globals.css) — the mark uses these directly so it reads as "the
// site's colors" rather than a one-off palette.
const PINK = "#ff6aa2";
const PURPLE = "#9b7bff";
const TEAL = "#4fd6c9";
const YELLOW = "#ffdd6b";

/**
 * The site's real display/body fonts (Fredoka, Nunito), loaded from local
 * TTFs for `ImageResponse`'s `fonts` option. `next/font/google` only wires
 * fonts into normal React DOM rendering, not satori, so icon/OG routes need
 * their own copy of the font bytes — see src/lib/cards/fonts/.
 */
export async function loadCardFonts() {
  const dir = path.join(process.cwd(), "src/lib/cards/fonts");
  const [fredokaBold, nunitoRegular] = await Promise.all([
    readFile(path.join(dir, "Fredoka-Bold.ttf")),
    readFile(path.join(dir, "Nunito-Regular.ttf")),
  ]);
  return [
    { name: "Fredoka", data: fredokaBold, weight: 700 as const, style: "normal" as const },
    { name: "Nunito", data: nunitoRegular, weight: 400 as const, style: "normal" as const },
  ];
}

/**
 * Shared bingo-mark glyph: 9 rounded cells, 5 dots, one diagonal line.
 * Renders through `next/og`'s `ImageResponse` (satori), not normal React DOM,
 * so keep markup within satori's supported SVG subset.
 */
export function BingoGlyph({ size, background }: { size: number; background?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {background ? <rect x="2" y="2" width="60" height="60" rx="16" fill={background} /> : null}
      <g>
        <rect x="9" y="9" width="14" height="14" rx="3" fill={CELL} />
        <rect x="25" y="9" width="14" height="14" rx="3" fill={CELL} />
        <rect x="41" y="9" width="14" height="14" rx="3" fill={CELL} />
        <rect x="9" y="25" width="14" height="14" rx="3" fill={CELL} />
        <rect x="25" y="25" width="14" height="14" rx="3" fill={CELL} />
        <rect x="41" y="25" width="14" height="14" rx="3" fill={CELL} />
        <rect x="9" y="41" width="14" height="14" rx="3" fill={CELL} />
        <rect x="25" y="41" width="14" height="14" rx="3" fill={CELL} />
        <rect x="41" y="41" width="14" height="14" rx="3" fill={CELL} />
      </g>
      <circle cx="16" cy="16" r="5" fill={PINK} />
      <circle cx="48" cy="16" r="5" fill={TEAL} />
      <circle cx="32" cy="32" r="5" fill={PURPLE} />
      <circle cx="16" cy="48" r="5" fill={TEAL} />
      <circle cx="48" cy="48" r="5" fill={PINK} />
      <line x1="13" y1="13" x2="51" y2="51" stroke={YELLOW} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The "B!" badge that sits in the top-right corner of the mark on the
 * static favicon (src/app/icon.svg). Rendered as an overlay div rather
 * than SVG `<text>` — satori (which powers `ImageResponse`) doesn't
 * support SVG text nodes. Pair with a `size`-matched `BingoGlyph` inside
 * a `position: relative` wrapper the same pixel size as `size`.
 */
export function BingoBadge({ size }: { size: number }) {
  const scale = size / 64;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        left: 41 * scale,
        top: 1 * scale,
        width: 22 * scale,
        height: 22 * scale,
        borderRadius: "9999px",
        background: TEAL,
        border: `${2 * scale}px solid #fff9f0`,
        color: "#fff9f0",
        fontSize: 13 * scale,
        fontWeight: 700,
        fontFamily: "Fredoka",
      }}
    >
      B!
    </div>
  );
}
