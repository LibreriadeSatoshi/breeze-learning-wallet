import { useT, useLocale } from "@/lib/i18n/hook";

export function useFormatRelativeTime(): (iso: string | null) => string {
  const t = useT();
  const { locale } = useLocale();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  return (iso) => {
    if (!iso) return t("common.never");
    const then = new Date(iso).getTime();
    if (isNaN(then)) return t("common.never");
    const diffSec = Math.round((then - Date.now()) / 1000);

    if (Math.abs(diffSec) < 10) return t("common.justNow");
    if (Math.abs(diffSec) < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (Math.abs(diffSec) < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (Math.abs(diffSec) < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
    return new Date(iso).toLocaleDateString(locale);
  };
}
