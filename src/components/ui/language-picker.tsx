import { useLocale, useT } from "@/lib/i18n/hook";
import { Locale, LOCALE_LABELS, LOCALES } from "@/lib/i18n/types";

export function LanguagePickerSection() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label={t("settings.language.title")}
      className="w-full min-h-field px-3 rounded border-1.5 border-input bg-surface text-fg text-body-sm hover:border-strong"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}