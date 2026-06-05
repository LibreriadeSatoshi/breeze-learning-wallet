const KEY_CLAIM_LEEWAY = "scholar-wallet:claim-leeway";

export const DEFAULT_CLAIM_LEEWAY = 2;

export function getClaimLeeway(): number {
  if (typeof window === "undefined") return DEFAULT_CLAIM_LEEWAY;
  const raw = window.localStorage.getItem(KEY_CLAIM_LEEWAY);
  if (!raw) return DEFAULT_CLAIM_LEEWAY;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 0) return DEFAULT_CLAIM_LEEWAY;
  return parsed;
}

export function setClaimLeeway(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_CLAIM_LEEWAY, String(Math.max(0, Math.floor(value))));
}
