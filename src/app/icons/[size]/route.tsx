import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

const VALID_SIZES = new Set([192, 512]);
const CELL = "#fff9f0";

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
        <svg width={px} height={px} viewBox="0 0 64 64">
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
      </div>
    ),
    { width: px, height: px },
  );
}
