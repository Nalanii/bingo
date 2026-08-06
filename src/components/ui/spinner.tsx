import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpinnerProps = React.SVGAttributes<SVGSVGElement>;

/**
 * A small spinning loading indicator. Hidden from assistive tech —
 * pending state should be announced through other means (e.g. button
 * text, `aria-live`), not this icon.
 */
export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("h-4 w-4 animate-spin", className)}
      {...props}
    />
  );
}
