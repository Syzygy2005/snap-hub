// The tracker key is remembered in this browser so "My stats" can load without pasting it each time.
const STORAGE_KEY = "snaphub:tracker-key";

export function loadTrackerKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveTrackerKey(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // storage unavailable
  }
}

export function forgetTrackerKey() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
}
