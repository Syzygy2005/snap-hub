"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "snaphub:theme";
const CHANGE_EVENT = "snaphub:theme-change";
type Theme = "light" | "dark";
const normalizeTheme = (value: string | null | undefined): Theme => value === "dark" ? "dark" : "light";
const getSnapshot = () => normalizeTheme(document.documentElement.dataset.theme);
const getServerSnapshot = (): Theme => "light";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = normalizeTheme(event.newValue);
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function toggleTheme() {
  const theme = getSnapshot() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The current page can still switch when the browser blocks persistent storage.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" onClick={toggleTheme} aria-label={label} title={label}
    className="brand-action inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:bg-surface hover:text-ink">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {theme === "dark" ? <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </> : <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />}
    </svg>
  </button>;
}
