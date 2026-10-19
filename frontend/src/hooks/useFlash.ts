"use client";

import { useEffect, useRef, useState } from "react";

export const FLASH_MS = 300;

/**
 * Returns `"flash-up"` / `"flash-down"` for FLASH_MS after `value` rises/falls,
 * then `""` (the CSS transition fades the background back out).
 */
export function useFlash(value: number | null | undefined): string {
  const prev = useRef<number | null | undefined>(value);
  const [cls, setCls] = useState("");

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before == null || value == null || before === value) return;
    setCls(value > before ? "flash-up" : "flash-down");
    const t = setTimeout(() => setCls(""), FLASH_MS);
    return () => clearTimeout(t);
  }, [value]);

  return cls;
}
