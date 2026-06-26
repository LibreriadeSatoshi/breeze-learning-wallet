"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { type Locale, DEFAULT_LOCALE } from "./types";
import { detectInitialLocale, setStoredLocale } from "./storage";

const dictionaries = { en, es } as const;

type Messages = typeof en;

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = (next: Locale) => {
    setStoredLocale(next);
    setLocaleState(next);
  };

  const messages = dictionaries[locale];

  return (
    <LocaleContext.Provider value={{ locale, messages, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocaleContext must be used within LocaleProvider");
  return ctx;
}
