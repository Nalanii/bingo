import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CELL = "#fff9f0";

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
        <svg width="320" height="320" viewBox="0 0 64 64">
          <rect x="2" y="2" width="60" height="60" rx="16" fill="#211b33" />
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
    { ...size },
  );
}
