const CELLS = [
  { label: "🌍 Trip", done: true },
  { label: "📚 12 books", done: false },
  { label: "🏃 5k", done: true },
  { label: "🎸 New song", done: false },
  { label: "⭐ FREE", done: true, free: true },
  { label: "🍜 Cook 10", done: false },
  { label: "💧 Hydrate", done: true },
  { label: "🎨 Paint", done: false },
  { label: "😴 Sleep 8h", done: true },
];

/** Decorative 3×3 bingo card shown on the landing page. */
export function MiniBingoPreview() {
  return (
    <div className="w-full max-w-sm rotate-2 rounded-[var(--radius-lg)] border-2 border-border bg-card p-4 shadow-[0_10px_0_0_rgba(0,0,0,0.08)]">
      <p className="mb-3 text-center font-display text-lg font-bold">
        My 2026 Card
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CELLS.map((c, i) => (
          <div
            key={i}
            className={[
              "flex aspect-square items-center justify-center rounded-[var(--radius-md)] p-1 text-center text-xs font-bold",
              c.free
                ? "bg-accent text-accent-foreground"
                : c.done
                  ? "bg-success text-success-foreground"
                  : "border-2 border-border bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}
