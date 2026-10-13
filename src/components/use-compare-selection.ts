"use client";

import { useCallback, useEffect, useState } from "react";

// Comparison picks live in localStorage so they survive navigation between pages.
const STORAGE_KEY = "safebite.compare";
const EVENT = "safebite:compare-change";
export const MAX_SELECTION = 3;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_SELECTION) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SELECTION)));
  window.dispatchEvent(new Event(EVENT));
}

export function useCompareSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setSelected(read());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = read();
    if (current.includes(slug)) write(current.filter((s) => s !== slug));
    else if (current.length < MAX_SELECTION) write([...current, slug]);
  }, []);

  const clear = useCallback(() => write([]), []);

  return { selected, toggle, clear, ready };
}
