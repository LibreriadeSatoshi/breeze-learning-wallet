const KEY_CLAIM_LEEWAY = "scholar-wallet:claim-leeway";
const KEY_FIAT_CURRENCY = "scholar-wallet:fiat-currency";

export const DEFAULT_CLAIM_LEEWAY = 2;
export const DEFAULT_FIAT_CURRENCY = "USD";

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

export function getSelectedCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_FIAT_CURRENCY;
  return window.localStorage.getItem(KEY_FIAT_CURRENCY) ?? DEFAULT_FIAT_CURRENCY;
}

export function setSelectedCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_FIAT_CURRENCY, currency);
}
