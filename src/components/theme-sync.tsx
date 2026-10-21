"use client";

import { useEffect } from "react";
import { applyTheme, getThemePreference, watchSystemTheme } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => {
    applyTheme(getThemePreference());
    return watchSystemTheme(() => {
      if (getThemePreference() === "system") applyTheme("system");
    });
  }, []);
  return null;
}
