import { useSyncExternalStore } from "react";

/** Dark ("Event Horizon") is the default; light is an opt-in reading mode saved on this device. */
export type Theme = "dark" | "light";
const KEY = "lq_theme";
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

let current: Theme = typeof window === "undefined" ? "dark" : read();

export function setTheme(t: Theme) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "dark"
  );
}

/** Applies the saved theme while the terminal is mounted; the landing page always stays dark. */
export function mountTheme() {
  document.documentElement.dataset.theme = current;
  return () => {
    document.documentElement.dataset.theme = "dark";
  };
}
