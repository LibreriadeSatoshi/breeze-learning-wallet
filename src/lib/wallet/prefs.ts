import { storageKey } from "@/lib/storage/storage-keys";

const KEY_CLAIM_LEEWAY = storageKey("claim-leeway");
const KEY_FIAT_CURRENCY = storageKey("fiat-currency");

export const DEFAULT_CLAIM_LEEWAY = 2;
export const MAX_CLAIM_LEEWAY = 50;
export const DEFAULT_FIAT_CURRENCY = "USD";

export function parseClaimLeeway(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_CLAIM_LEEWAY ? value : null;
}

// An out-of-range value stored by an older build would stop the SDK from connecting.
export function getClaimLeeway(): number {
  if (typeof window === "undefined") return DEFAULT_CLAIM_LEEWAY;
  const raw = window.localStorage.getItem(KEY_CLAIM_LEEWAY);
  return (raw === null ? null : parseClaimLeeway(raw)) ?? DEFAULT_CLAIM_LEEWAY;
}

export function setClaimLeeway(value: number): void {
  if (typeof window === "undefined") return;
  if (parseClaimLeeway(String(value)) === null) throw new RangeError("Invalid claim leeway");
  window.localStorage.setItem(KEY_CLAIM_LEEWAY, String(value));
}

export function getSelectedCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_FIAT_CURRENCY;
  return window.localStorage.getItem(KEY_FIAT_CURRENCY) ?? DEFAULT_FIAT_CURRENCY;
}

export function setSelectedCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_FIAT_CURRENCY, currency);
}
