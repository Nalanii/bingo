import { ImageResponse } from "next/og";
import { getOwnedCard } from "@/lib/cards/access";
import { countCompletionsBySquare, computeCardProgress } from "@/lib/cards/progress";
import { getCompletions } from "@/lib/firestore/completions";
import type { Square } from "@/lib/firestore/cards";
import { BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";

export const contentType = "image/png";

const CANVAS = 1080;
const PADDING = 64;

// Fixed vertical budget for everything above the board, so the board's cell
// size can be computed to fit the space actually left over rather than
// overflowing the canvas — satori stacks flex children at their natural
// size with no shrink-to-fit, so this has to be done in JS up front.
const HEADER_HEIGHT = 56;
const TITLE_HEIGHT = 130; // room for up to ~2 wrapped lines at TITLE_FONT_SIZE
const PROGRESS_HEIGHT = 20;
const GAP_HEADER_TITLE = 28;
const GAP_TITLE_PROGRESS = 24;
const GAP_PROGRESS_BOARD = 32;
const RESERVED_HEIGHT =
  HEADER_HEIGHT + GAP_HEADER_TITLE + TITLE_HEIGHT + GAP_TITLE_PROGRESS + PROGRESS_HEIGHT + GAP_PROGRESS_BOARD;

// Dark-mode brand tokens from src/app/globals.css, hardcoded because satori
// (which powers ImageResponse) can't read CSS custom properties — same
// approach as src/app/opengraph-image.tsx.
const BACKGROUND = "#171325";
const FOREGROUND = "#f4eeff";
const MUTED = "#2a2340";
const PRIMARY = "#ff6aa2";
const ACCENT = "#ffdd6b";
const ACCENT_FOREGROUND = "#211e2e";
const SUCCESS = "#4fd6c9";
const SUCCESS_FOREGROUND = "#06312c";

// Tailwind's `/10`, `/20`, `/40` alpha-modifier utilities (used for the
// interactive board's incomplete/partial tints in bingo-grid.tsx) have no
// satori equivalent, so the same colors are reproduced here as literal rgba()
// values — satori supports standard CSS color syntax including rgba().
const PRIMARY_TINT_BG = "rgba(255, 106, 162, 0.1)"; // primary/10
const PRIMARY_TINT_BORDER = "rgba(255, 106, 162, 0.4)"; // primary/40
const SUCCESS_PARTIAL_BG = "rgba(79, 214, 201, 0.2)"; // success/20

/** A square is done when it's the free space or its completion count reaches its goal. Mirrors the private helper of the same name in src/lib/cards/progress.ts. */
function isSquareDone(square: Square, count: number): boolean {
  return square.isFreeSpace || count >= square.goal;
}

function ExportSquare({ square, count, cellSize }: { square: Square; count: number; cellSize: number }) {
  const done = isSquareDone(square, count);
  const isCounter = square.kind === "COUNTER" && !square.isFreeSpace;
  const isPartial = isCounter && count > 0 && !done;

  const background = square.isFreeSpace
    ? ACCENT
    : done
      ? SUCCESS
      : isPartial
        ? SUCCESS_PARTIAL_BG
        : PRIMARY_TINT_BG;
  const borderColor = square.isFreeSpace
    ? ACCENT
    : done || isPartial
      ? SUCCESS
      : PRIMARY_TINT_BORDER;
  const textColor = square.isFreeSpace ? ACCENT_FOREGROUND : done ? SUCCESS_FOREGROUND : FOREGROUND;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: cellSize,
        height: cellSize,
        borderRadius: 14,
        border: `3px solid ${borderColor}`,
        background,
        padding: 10,
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {square.isFreeSpace ? (
        <>
          <div style={{ display: "flex", fontSize: cellSize * 0.24 }}>⭐</div>
          <div
            style={{
              display: "flex",
              marginTop: 6,
              fontSize: cellSize * 0.1,
              fontWeight: 700,
              fontFamily: "Fredoka",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: textColor,
            }}
          >
            Free space
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              fontSize: cellSize * 0.13,
              fontWeight: 600,
              lineHeight: 1.15,
              color: textColor,
              maxHeight: cellSize * 0.62,
              overflow: "hidden",
            }}
          >
            {square.label}
          </div>
          {isCounter && (
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontSize: cellSize * 0.11,
                fontWeight: 700,
                fontFamily: "Fredoka",
                color: textColor,
              }}
            >
              {count}/{square.goal}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Renders a shareable PNG snapshot of a bingo card: title, brand mark,
 * progress bar, and the full board — a static image with no interactive
 * chrome (no +/− controls, no tap affordances, no history captions).
 * See GitHub issue #60.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOwnedCard(id);
  if (!result.ok) {
    return new Response(result.error, { status: 404 });
  }
  const { card } = result;

  const completions = await getCompletions(id);
  const countsBySquareId = countCompletionsBySquare(completions);
  const { completedCount, totalCount } = computeCardProgress(card.gridSize, card.squares, completions);
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  const contentWidth = CANVAS - PADDING * 2;
  const contentHeight = CANVAS - PADDING * 2;
  const gap = card.gridSize >= 5 ? 10 : 14;
  // Cell size is the smaller of the width-constrained and height-constrained
  // fits, so the board never overflows the canvas bottom regardless of
  // gridSize (see RESERVED_HEIGHT above for what's already spoken for).
  const availableGridHeight = contentHeight - RESERVED_HEIGHT;
  const widthBasedCellSize = (contentWidth - gap * (card.gridSize - 1)) / card.gridSize;
  const heightBasedCellSize = (availableGridHeight - gap * (card.gridSize - 1)) / card.gridSize;
  const cellSize = Math.min(widthBasedCellSize, heightBasedCellSize);
  const gridWidth = cellSize * card.gridSize + gap * (card.gridSize - 1);
  const gridHeight = gridWidth;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: BACKGROUND,
        fontFamily: "Nunito",
        padding: PADDING,
      }}
    >
      {/* Brand mark lockup */}
      <div style={{ display: "flex", alignItems: "center", height: HEADER_HEIGHT }}>
        <BingoGlyph size={56} />
        <div
          style={{
            display: "flex",
            marginLeft: 14,
            fontFamily: "Fredoka",
            fontSize: 32,
            fontWeight: 700,
            color: FOREGROUND,
            letterSpacing: "-0.5px",
          }}
        >
          Bingoal
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          marginTop: GAP_HEADER_TITLE,
          height: TITLE_HEIGHT,
          fontFamily: "Fredoka",
          fontSize: 52,
          fontWeight: 700,
          color: FOREGROUND,
          letterSpacing: "-1px",
          lineHeight: 1.15,
          overflow: "hidden",
        }}
      >
        {card.name}
      </div>

      {/* Progress bar */}
      <div
        style={{
          display: "flex",
          marginTop: GAP_TITLE_PROGRESS,
          width: "100%",
          height: PROGRESS_HEIGHT,
          borderRadius: 9999,
          background: MUTED,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            width: `${progressPercent}%`,
            height: "100%",
            borderRadius: 9999,
            background: `linear-gradient(to right, ${PRIMARY}, ${ACCENT})`,
          }}
        />
      </div>

      {/* Board — centered in case the height-constrained cell size leaves
          the grid narrower than the full content width. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: GAP_PROGRESS_BOARD,
          width: contentWidth,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignContent: "flex-start",
            gap,
            width: gridWidth,
            height: gridHeight,
          }}
        >
          {slots.map((square, position) =>
            square ? (
              <ExportSquare
                key={square.id}
                square={square}
                count={countsBySquareId[square.id] ?? 0}
                cellSize={cellSize}
              />
            ) : (
              <div
                key={position}
                style={{
                  display: "flex",
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 14,
                  border: `3px dashed ${MUTED}`,
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>,
    { width: CANVAS, height: CANVAS, fonts: await loadCardFonts() },
  );
}
