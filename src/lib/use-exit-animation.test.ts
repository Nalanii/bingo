// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExitAnimation } from "./use-exit-animation";

describe("useExitAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the open state", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    expect(result.current.state).toBe("open");
  });

  it("switches to closing immediately but delays the callback", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    const callback = vi.fn();

    act(() => {
      result.current.requestClose(callback);
    });

    expect(result.current.state).toBe("closing");
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("ignores a second requestClose call while already closing", () => {
    const { result } = renderHook(() => useExitAnimation(150));
    const first = vi.fn();
    const second = vi.fn();

    act(() => {
      result.current.requestClose(first);
    });
    act(() => {
      result.current.requestClose(second);
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
