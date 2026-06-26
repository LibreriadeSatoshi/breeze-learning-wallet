"use client";

import { useCallback } from "react";
import { useLocaleContext } from "./provider";
import type { Locale } from "./types";

type Params = Record<string, string | number>;

function resolve(obj: unknown, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return key in params ? String(params[key]) : `{{${key}}}`;
  });
}

export function useT(): (key: string, params?: Params) => string {
  const { messages } = useLocaleContext();
  return useCallback(
    (key, params) => interpolate(resolve(messages, key), params),
    [messages],
  );
}

export function useLocale(): {
  locale: Locale;
  setLocale: (locale: Locale) => void;
} {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}
