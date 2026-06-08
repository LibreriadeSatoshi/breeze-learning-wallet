export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "Never";
  const diffSec = Math.round((Date.now() - then) / 1000);

  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffSec < 3600) {
    const m = Math.round(diffSec / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400) {
    const h = Math.round(diffSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diffSec < 86400 * 7) {
    const d = Math.round(diffSec / 86400);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return new Date(iso).toLocaleDateString();
}
