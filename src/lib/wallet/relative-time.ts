const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "Never";
  const diffSec = Math.round((then - Date.now()) / 1000);

  if (Math.abs(diffSec) < 10) return "just now";
  if (Math.abs(diffSec) < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (Math.abs(diffSec) < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (Math.abs(diffSec) < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return new Date(iso).toLocaleDateString();
}
