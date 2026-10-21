import { storageKey } from "@/lib/storage/storage-keys";

export type ThemePreference = "light" | "hacker" | "system";
export type ResolvedTheme = "light" | "hacker";

export const THEME_KEY = storageKey("theme");
export const THEME_PREFERENCES: ThemePreference[] = ["light", "hacker", "system"];

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#ffffff", hacker: "#000000" };

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as string[]).includes(value);
}

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isPreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(DARK_QUERY).matches ? "hacker" : "light";
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.content = THEME_COLORS[resolved];
    });
}

export function setThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this page.
  }
  applyTheme(preference);
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Runs inline in <head> before first paint, so it cannot import anything.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});var t=p==="light"||p==="hacker"?p:(window.matchMedia&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches?"hacker":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;
