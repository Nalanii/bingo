const CELL = "#fff9f0";

/**
 * Shared bingo-mark glyph: 9 rounded cells, 5 dots, one diagonal line.
 * Renders through `next/og`'s `ImageResponse` (satori), not normal React DOM,
 * so keep markup within satori's supported SVG subset.
 */
export function BingoGlyph({
  size,
  background,
}: {
  size: number;
  background?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {background ? (
        <rect x="2" y="2" width="60" height="60" rx="16" fill={background} />
      ) : null}
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
      <circle cx="16" cy="16" r="5" fill="#ff4d8d" />
      <circle cx="48" cy="16" r="5" fill="#2f9bff" />
      <circle cx="32" cy="32" r="5" fill="#2f9bff" />
      <circle cx="16" cy="48" r="5" fill="#ff4d8d" />
      <circle cx="48" cy="48" r="5" fill="#ff4d8d" />
      <line
        x1="13"
        y1="13"
        x2="51"
        y2="51"
        stroke="#ffd23f"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
