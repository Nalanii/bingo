"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_EXIT_DURATION_MS = 150;

export type ExitAnimationState = "open" | "closing";

/**
 * Lets a conditionally-rendered overlay/dialog play a CSS exit animation
 * before it actually goes away. The parent still owns whether the component
 * is mounted at all (e.g. `{show && <ConfirmDialog ... />}`) — this hook
 * only delays the component's own calls to its close callbacks
 * (`onCancel`/`onConfirm`/`onClose`) by `durationMs`, so there's time for a
 * `data-state="closing"` CSS animation to play before the parent unmounts
 * it.
 */
export function useExitAnimation(durationMs: number = DEFAULT_EXIT_DURATION_MS) {
  const [state, setState] = useState<ExitAnimationState>("open");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function requestClose(callback: () => void) {
    if (state === "closing") return;
    setState("closing");
    timeoutRef.current = setTimeout(callback, durationMs);
  }

  return { state, requestClose };
}
