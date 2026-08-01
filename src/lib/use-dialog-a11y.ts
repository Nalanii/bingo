"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard dialog keyboard behavior: on mount, moves focus to the first
 * focusable element inside `containerRef` and remembers what was focused
 * before; while mounted, traps Tab/Shift+Tab within the container and calls
 * `onClose` on Escape; on unmount, restores focus to the remembered element.
 *
 * Takes `onClose` by ref internally so the setup/teardown effect only runs
 * on mount/unmount, not whenever the caller passes a new closure identity
 * (e.g. an inline arrow function) on re-render — re-running it would
 * re-capture "previously focused" mid-interaction and yank focus back to
 * the first control.
 */
export function useDialogA11y(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initialTarget = getFocusable()[0] ?? container;
    initialTarget.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = getFocusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
    // Intentionally omitting onClose: it's read via onCloseRef so this
    // effect only needs to re-run when containerRef itself changes.
  }, [containerRef]);
}
