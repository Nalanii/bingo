import { ImageResponse } from "next/og";
import { getOwnedCard } from "@/lib/cards/access";
import { countCompletionsBySquare } from "@/lib/cards/progress";
import { getCompletions, type Completion } from "@/lib/firestore/completions";
import type { Square } from "@/lib/firestore/cards";
import { BingoGlyph, loadCardFonts } from "@/lib/cards/bingo-mark";
import { getCompletionPhotoSignedUrl } from "@/lib/firebase/storage";
import {
  FOOTNOTE_HEADING_HEIGHT,
  FOOTNOTE_ROW_GAP,
  FOOTNOTE_ROW_HEIGHT_WITH_NOTE,
  FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE,
  FOOTNOTE_SECTION_TOP_GAP,
  FOOTNOTE_THUMBNAIL_SIZE,
  buildFootnoteEntries,
  computeFootnoteSectionHeight,
  footnoteNumberBySquareId,
  getFootnoteCandidateSquares,
  type FootnoteEntry,
} from "@/lib/cards/export-footnotes";

export const contentType = "image/png";

const CANVAS = 1080;
const PADDING = 32;

// Fixed vertical budget for everything above/below the board, so the board's
// cell size can be computed to fit the space actually left over rather than
// overflowing the canvas — satori stacks flex children at their natural
// size with no shrink-to-fit, so this has to be done in JS up front. Kept as
// tight as legibility allows so the board — the actual point of the image —
// fills as much of the canvas as possible.
const TITLE_FONT_SIZE = 57; // ~50% bigger than the previous 38
const TITLE_HEIGHT = 132; // room for up to ~2 wrapped lines at TITLE_FONT_SIZE
const GAP_TITLE_BOARD = 10;
const GAP_BOARD_FOOTER = 10;
const FOOTER_HEIGHT = 46;
const RESERVED_HEIGHT = TITLE_HEIGHT + GAP_TITLE_BOARD + GAP_BOARD_FOOTER + FOOTER_HEIGHT;

// Dark-mode brand tokens from src/app/globals.css, hardcoded because satori
// (which powers ImageResponse) can't read CSS custom properties — same
// approach as src/app/opengraph-image.tsx.
const BACKGROUND = "#171325";
const FOREGROUND = "#f4eeff";
const MUTED_FOREGROUND = "#b0a6c9";
const PRIMARY = "#ff6aa2";
const SECONDARY = "#9b7bff";
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

/**
 * Small numbered circle used both as a square's corner marker and as each
 * row's number in the "Notes" section below the board. Rendered as a div
 * (not SVG `<text>`, which satori doesn't support) — same technique as
 * `BingoBadge` in src/lib/cards/bingo-mark.tsx.
 */
function FootnoteBadge({ number, diameter }: { number: number; diameter: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: diameter,
        height: diameter,
        borderRadius: "9999px",
        background: SECONDARY,
        border: "2px solid #fff9f0",
        color: "#fff9f0",
        fontSize: diameter * 0.5,
        fontWeight: 700,
        fontFamily: "Fredoka",
      }}
    >
      {number}
    </div>
  );
}

function ExportSquare({
  square,
  count,
  cellSize,
  latestCompletionDate,
  footnoteNumber,
}: {
  square: Square;
  count: number;
  cellSize: number;
  latestCompletionDate: string | undefined;
  footnoteNumber: number | undefined;
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
  // positioned footer below for why that matters). Kept as small as still
  // legible — a COUNTER square with both a count row AND a caption is the
  // tightest case, and a bigger footer here directly starves the label's
  // budget below, forcing an unnecessarily short (or truncated) label for
  // that combination specifically.
  const countRowHeight = isCounter ? cellSize * 0.12 : 0;
  const captionHeight = captionLabel ? cellSize * 0.13 : 0;
  const footerGap = isCounter && captionLabel ? cellSize * 0.015 : 0;
  const footerHeight = countRowHeight + footerGap + captionHeight;

  // -webkit-line-clamp needs a whole-number line count, not an arbitrary
  // maxHeight — a maxHeight that cuts off *mid*-line (the previous approach)
  // clips the text without ever reaching the line it would have added "…"
  // to, so some overflowing labels showed no truncation indicator at all.
  // Deriving the clamp from the same budget instead keeps the two in sync:
  // maxHeight always equals exactly `labelLines` whole lines.
  const labelFontSize = cellSize * 0.1;
  const labelLineHeight = labelFontSize * 1.15;
  const labelBudget = cellSize * 0.62 - footerHeight;
  const labelLines = Math.max(1, Math.floor(labelBudget / labelLineHeight));

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: cellSize * 0.24 }}>⭐</div>
          <div
            style={{
              display: "flex",
              // Proportional (not a flat px value) so the gap keeps reading
              // as a clear line break rather than a cramped stack as cellSize
              // grows with the board.
              marginTop: cellSize * 0.06,
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
        </div>
      ) : (
        <div
          style={{
            // -webkit-line-clamp (satori supports it, same as browsers) caps
            // the label at a whole number of lines AND paints a trailing "…"
            // when it truncates, unlike plain overflow:hidden which just cuts
            // the text off with no indication anything was clipped.
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitBoxPack: "center",
            WebkitBoxAlign: "center",
            WebkitLineClamp: labelLines,
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: labelFontSize,
            fontWeight: 600,
            lineHeight: 1.15,
            color: textColor,
            textAlign: "center",
            justifyContent: "center",
            width: "100%",
            maxHeight: labelLines * labelLineHeight,
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
            <div style={{ display: "flex", fontSize: cellSize * 0.095, fontWeight: 700, fontFamily: "Fredoka", color: textColor }}>
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
      {footnoteNumber !== undefined && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex" }}>
          <FootnoteBadge number={footnoteNumber} diameter={26} />
        </div>
      )}
    </div>
  );
}

/**
 * The "Notes" section below the board: one row per footnote-candidate
 * square, in the same numbered order as their corner badges. Renders
 * nothing when `entries` is empty, so cards with no notes/photos get no
 * extra markup at all.
 */
function ExportFootnotes({ entries, width }: { entries: FootnoteEntry[]; width: number }) {
  if (entries.length === 0) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: FOOTNOTE_SECTION_TOP_GAP, width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", width }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: FOOTNOTE_HEADING_HEIGHT,
            fontFamily: "Fredoka",
            fontSize: 24,
            fontWeight: 700,
            color: FOREGROUND,
          }}
        >
          Notes
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: FOOTNOTE_ROW_GAP }}>
          {entries.map((entry) => (
            <div
              key={entry.squareId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                height: entry.note ? FOOTNOTE_ROW_HEIGHT_WITH_NOTE : FOOTNOTE_ROW_HEIGHT_WITHOUT_NOTE,
              }}
            >
              <FootnoteBadge number={entry.number} diameter={32} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, justifyContent: "center" }}>
                <div
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: 20,
                    fontWeight: 700,
                    color: FOREGROUND,
                    maxHeight: 24,
                  }}
                >
                  {entry.label}
                </div>
                {entry.note && (
                  <div
                    style={{
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 4,
                      fontSize: 17,
                      lineHeight: 1.3,
                      color: MUTED_FOREGROUND,
                      maxHeight: 17 * 1.3 * 2,
                    }}
                  >
                    {entry.note}
                  </div>
                )}
              </div>
              {entry.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- satori (next/og's ImageResponse) requires a plain <img>, not next/image.
                <img
                  src={entry.photoUrl}
                  alt=""
                  width={FOOTNOTE_THUMBNAIL_SIZE}
                  height={FOOTNOTE_THUMBNAIL_SIZE}
                  style={{
                    width: FOOTNOTE_THUMBNAIL_SIZE,
                    height: FOOTNOTE_THUMBNAIL_SIZE,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a shareable PNG snapshot of a bingo card: title, board (including
 * each square's completion date and, where applicable, a numbered badge
 * pointing at a "Notes" entry with its note text and/or photo), and a small
 * Bingoal credit + generation date footer — a static image with no
 * interactive chrome (no +/− controls, no tap affordances). See GitHub
 * issues #60 and #64.
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
  const latestCompletionsBySquareId = completions.reduce<Record<string, Completion>>(
    (latest, completion) => {
      const existing = latest[completion.squareId];
      if (!existing || completion.completedAt > existing.completedAt) {
        latest[completion.squareId] = completion;
      }
      return latest;
    },
    {},
  );

  const squaresByPosition = new Map(card.squares.map((square) => [square.position, square]));
  const slotCount = card.gridSize * card.gridSize;
  const slots = Array.from({ length: slotCount }, (_, position) => squaresByPosition.get(position));

  // Each square whose latest completion has a note and/or a photo gets a
  // numbered footnote — see
  // docs/superpowers/specs/2026-08-18-export-image-notes-photos-design.md.
  const footnoteCandidates = getFootnoteCandidateSquares(slots, latestCompletionsBySquareId);
  const resolvedFootnoteCandidates = await Promise.all(
    footnoteCandidates.map(async (candidate) => {
      if (!candidate.completion.photoPath) {
        return { ...candidate, photoUrl: undefined };
      }
      try {
        const photoUrl = await getCompletionPhotoSignedUrl(candidate.completion.photoPath);
        return { ...candidate, photoUrl };
      } catch (error) {
        console.error("export-image: failed to sign completion photo URL", error);
        return { ...candidate, photoUrl: undefined };
      }
    }),
  );
  const footnoteEntries = buildFootnoteEntries(resolvedFootnoteCandidates);
  const footnoteNumbers = footnoteNumberBySquareId(footnoteEntries);
  const footnoteSectionHeight = computeFootnoteSectionHeight(footnoteEntries);

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
          fontSize: TITLE_FONT_SIZE,
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
                latestCompletionDate={latestCompletionsBySquareId[square.id]?.completedAt.toISOString()}
                footnoteNumber={footnoteNumbers[square.id]}
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
          <BingoGlyph size={28} />
          {/* Matches SiteHeader's colored-letter wordmark (src/components/site-header.tsx) exactly. */}
          <div style={{ display: "flex", marginLeft: 8, fontFamily: "Fredoka", fontSize: 18, fontWeight: 700 }}>
            <div style={{ display: "flex", color: PRIMARY }}>B</div>
            <div style={{ display: "flex", color: SECONDARY }}>i</div>
            <div style={{ display: "flex", color: SUCCESS }}>n</div>
            <div style={{ display: "flex", color: PRIMARY }}>g</div>
            <div style={{ display: "flex", color: ACCENT }}>o</div>
            <div style={{ display: "flex", color: FOREGROUND }}>al</div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 5, fontSize: 12, color: MUTED_FOREGROUND }}>Generated on {generatedOn}</div>
      </div>

      <ExportFootnotes entries={footnoteEntries} width={contentWidth} />
    </div>,
    { width: CANVAS, height: CANVAS + footnoteSectionHeight, fonts: await loadCardFonts() },
  );
}
