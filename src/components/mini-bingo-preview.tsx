import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell =
  | { kind: "free"; label: string }
  | { kind: "check"; label: string; done: boolean; completedDate?: string }
  | { kind: "counter"; label: string; count: number; goal: number; completedDate?: string };

const CELLS: Cell[] = [
  { kind: "check", label: "Visit Japan", done: true, completedDate: "Mar 2, 2026" },
  { kind: "counter", label: "Read 12 books", count: 5, goal: 12, completedDate: "Jun 18, 2026" },
  { kind: "check", label: "Run a 5k", done: true, completedDate: "Apr 27, 2026" },
  { kind: "check", label: "Learn guitar", done: false },
  { kind: "free", label: "⭐ FREE SPACE" },
  { kind: "counter", label: "Try 10 new recipes", count: 4, goal: 10, completedDate: "Jul 9, 2026" },
  { kind: "check", label: "Take an art class", done: false },
  { kind: "check", label: "Try pottery", done: true, completedDate: "Feb 14, 2026" },
  { kind: "counter", label: "Mediate 30 times", count: 30, goal: 30, completedDate: "Aug 2, 2026" },
];

/** Decorative 3×3 bingo card shown on the landing page. */
export function MiniBingoPreview() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-sm rotate-2 rounded-[var(--radius-lg)] border-2 border-border bg-card p-4 shadow-[0_10px_0_0_rgba(0,0,0,0.08)]"
    >
      <p className="mb-3 text-center font-display text-lg font-bold">
        Sam&apos;s 2026 Bingo
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CELLS.map((c, i) => {
          const isFree = c.kind === "free";
          const isDone = c.kind === "check" ? c.done : c.kind === "counter" ? c.count >= c.goal : false;
          const isPartial = c.kind === "counter" && c.count > 0 && c.count < c.goal;

          return (
            <div
              key={i}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border-2 p-1 text-center text-xs font-bold shadow-[0_2px_0_0_rgba(0,0,0,0.08)]",
                isFree
                  ? "border-accent bg-accent text-accent-foreground"
                  : isDone
                    ? "border-success bg-success text-success-foreground"
                    : isPartial
                      ? "border-success bg-success/20 text-card-foreground"
                      : "border-primary/40 bg-primary/10 text-card-foreground",
              )}
            >
              {isDone && !isFree && (
                <Check
                  aria-hidden="true"
                  className="absolute top-1 right-1 h-3 w-3 text-success-foreground"
                />
              )}
              <span>{c.label}</span>
              {c.kind === "counter" && (
                <span className="flex items-center gap-1.5">
                  <span className="text-sm leading-none">−</span>
                  <span className="text-[0.65rem] font-bold">
                    {c.count}/{c.goal}
                  </span>
                  <span className="text-sm leading-none">+</span>
                </span>
              )}
              {c.kind === "check" && c.done && c.completedDate && (
                <span className="absolute inset-x-1 bottom-1 flex flex-col text-[0.55rem] leading-tight italic">
                  <span>Completed:</span>
                  <span>{c.completedDate}</span>
                </span>
              )}
              {c.kind === "counter" && c.count > 0 && c.completedDate && (
                <span className="absolute inset-x-1 bottom-1 flex flex-col text-[0.55rem] leading-tight italic">
                  <span>Last completed:</span>
                  <span>{c.completedDate}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
