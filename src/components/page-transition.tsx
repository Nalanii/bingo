"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps route content in a subtle slide-up-fade that replays whenever the
 * pathname changes, giving dashboard navigations some motion instead of an
 * instant snap. Re-keying by `pathname` forces React to remount the wrapper
 * div, which restarts the CSS animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="[animation:slide-up-fade_200ms_ease-out]">
      {children}
    </div>
  );
}
