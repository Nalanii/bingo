import { ImageResponse } from "next/og";
import { getOwnedCard } from "@/lib/cards/access";
import { countCompletionsBySquare } from "@/lib/cards/progress";
import { getCompletions } from "@/lib/firestore/completions";
import type { Square } from "@/lib/firestore/cards";
import { BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";

export const contentType = "image/png";

const CANVAS = 1080;
const PADDING = 64;

// Fixed vertical budget for everything above/below the board, so the board's
// cell size can be computed to fit the space actually left over rather than
// overflowing the canvas — satori stacks flex children at their natural
// size with no shrink-to-fit, so this has to be done in JS up front.
const TITLE_HEIGHT = 130; // room for up to ~2 wrapped lines at TITLE_FONT_SIZE
const GAP_TITLE_BOARD = 40;
const GAP_BOARD_FOOTER = 36;
const FOOTER_HEIGHT = 78;
const RESERVED_HEIGHT = TITLE_HEIGHT + GAP_TITLE_BOARD + GAP_BOARD_FOOTER + FOOTER_HEIGHT;

// Dark-mode brand tokens from src/app/globals.css, hardcoded because satori
// (which powers ImageResponse) can't read CSS custom properties — same
// approach as src/app/opengraph-image.tsx.
const BACKGROUND = "#171325";
const FOREGROUND = "#f4eeff";
const MUTED_FOREGROUND = "#b0a6c9";
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

/** Formats an ISO 8601 timestamp as a local date with a full month name, e.g. "January 1, 2026". Mirrors the client-side helper of the same name in src/components/bingo-grid.tsx. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const CELL_PADDING = 10;

function ExportSquare({
  square,
  count,
  cellSize,
  latestCompletionDate,
}: {
  square: Square;
  count: number;
  cellSize: number;
  latestCompletionDate: string | undefined;
}) {
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

  // Mirrors bingo-grid.tsx's historyDateButton condition: a CHECK square
  // shows "Completed:" once done, a COUNTER square shows "Last completed:"
  // once it has any progress — both only when a date is actually on record.
  const captionLabel = !square.isFreeSpace && latestCompletionDate
    ? isCounter
      ? count > 0
        ? "Last completed:"
        : null
      : done
        ? "Completed:"
        : null
    : null;

  // Reserved footer space for the count/goal row and/or the completion-date
  // caption on COUNTER/CHECK squares, computed as plain numbers so they
  // never depend on satori measuring any wrapped text (see the absolutely
  // positioned footer below for why that matters).
  const countRowHeight = isCounter ? cellSize * 0.14 : 0;
  const captionHeight = captionLabel ? cellSize * 0.16 : 0;
  const footerGap = isCounter && captionLabel ? cellSize * 0.02 : 0;
  const footerHeight = countRowHeight + footerGap + captionHeight;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: cellSize,
        height: cellSize,
        borderRadius: 14,
        border: `3px solid ${borderColor}`,
        background,
        padding: CELL_PADDING,
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
        <div
          style={{
            display: "flex",
            fontSize: cellSize * 0.13,
            fontWeight: 600,
            lineHeight: 1.15,
            color: textColor,
            // Leave room above the footer (count/goal and/or caption) so the
            // (vertically-centered) label can never grow into it.
            maxHeight: cellSize * 0.62 - footerHeight,
            overflow: "hidden",
          }}
        >
          {square.label}
        </div>
      )}
      {footerHeight > 0 && (
        // Absolutely positioned (not a normal-flow sibling below the label)
        // and placed at a fixed pixel offset derived only from `cellSize` —
        // satori mismeasures the label's real height when it wraps to
        // multiple lines, so a flow sibling relying on that measurement to
        // stack "below" it ends up overlapping the label instead. Anchoring
        // from a cellSize-only offset sidesteps that entirely. (satori drops
        // `bottom`/`right` offsets, so this has to be expressed as `top`.)
        <div
          style={{
            position: "absolute",
            top: cellSize - CELL_PADDING - footerHeight,
            left: CELL_PADDING,
            width: cellSize - CELL_PADDING * 2,
            height: footerHeight,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {isCounter && (
            <div style={{ display: "flex", fontSize: cellSize * 0.11, fontWeight: 700, fontFamily: "Fredoka", color: textColor }}>
              {count}/{square.goal}
            </div>
          )}
          {captionLabel && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: isCounter ? footerGap : 0,
                fontSize: cellSize * 0.06,
                lineHeight: 1.2,
                color: textColor,
              }}
            >
              <div style={{ display: "flex" }}>{captionLabel}</div>
              <div style={{ display: "flex" }}>{formatDate(latestCompletionDate!)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a shareable PNG snapshot of a bingo card: title, board (including
 * each square's completion date where applicable), and a small Bingoal
 * credit + generation date footer — a static image with no interactive
 * chrome (no +/− controls, no tap affordances). See GitHub issue #60.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getOwnedCard(id);
  if (!result.ok) {
    // getOwnedCard collapses "not signed in" and "card missing/not yours" into
    // one error union — distinguish them here so an unauthenticated request
    // gets a 401 rather than being told the card doesn't exist.
    const status = result.error === "You need to sign in to do that." ? 401 : 404;
    return new Response(result.error, { status });
  }
  const { card } = result;

  const completions = await getCompletions(id);
  const countsBySquareId = countCompletionsBySquare(completions);
  const latestCompletionDates = completions.reduce<Record<string, string>>((latest, completion) => {
    const existing = latest[completion.squareId];
    if (!existing || completion.completedAt > new Date(existing)) {
      latest[completion.squareId] = completion.completedAt.toISOString();
    }
    return latest;
  }, {});

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  const contentWidth = CANVAS - PADDING * 2;
  const contentHeight = CANVAS - PADDING * 2;
  const gap = card.gridSize >= 5 ? 10 : 14;
  // Cell size is the smaller of the width-constrained and height-constrained
  // fits, so the board never overflows the canvas regardless of gridSize
  // (see RESERVED_HEIGHT above for what's already spoken for).
  const availableGridHeight = contentHeight - RESERVED_HEIGHT;
  const widthBasedCellSize = (contentWidth - gap * (card.gridSize - 1)) / card.gridSize;
  const heightBasedCellSize = (availableGridHeight - gap * (card.gridSize - 1)) / card.gridSize;
  const cellSize = Math.min(widthBasedCellSize, heightBasedCellSize);
  const gridWidth = cellSize * card.gridSize + gap * (card.gridSize - 1);
  const gridHeight = gridWidth;

  const generatedOn = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
      {/* Title */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          width: "100%",
          height: TITLE_HEIGHT,
          fontFamily: "Fredoka",
          fontSize: 52,
          fontWeight: 700,
          color: FOREGROUND,
          letterSpacing: "-1px",
          lineHeight: 1.15,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        {card.name}
      </div>

      {/* Board */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: GAP_TITLE_BOARD, width: contentWidth }}>
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
                latestCompletionDate={latestCompletionDates[square.id]}
              />
            ) : (
              <div
                key={position}
                style={{
                  display: "flex",
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 14,
                  border: "3px dashed #2a2340",
                }}
              />
            ),
          )}
        </div>
      </div>

      {/* Footer: brand credit + generation date, centered */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: GAP_BOARD_FOOTER,
          height: FOOTER_HEIGHT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <BingoGlyph size={40} />
          <div style={{ display: "flex", marginLeft: 10, fontFamily: "Fredoka", fontSize: 24, fontWeight: 700, color: FOREGROUND }}>
            Bingoal
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 16, color: MUTED_FOREGROUND }}>Generated on {generatedOn}</div>
      </div>
    </div>,
    { width: CANVAS, height: CANVAS, fonts: await loadCardFonts() },
  );
}
