import { type Locale, DEFAULT_LOCALE, LOCALES } from "./types";

const STORAGE_KEY = "scholar-wallet:locale";

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (LOCALES as readonly string[]).includes(stored)) {
    return stored as Locale;
  }
  return null;
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

export function detectInitialLocale(): Locale {
  const stored = getStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== "undefined" && navigator.language) {
    const browserLang = navigator.language.split("-")[0];
    if ((LOCALES as readonly string[]).includes(browserLang)) {
      return browserLang as Locale;
    }
  }
  return DEFAULT_LOCALE;
}
