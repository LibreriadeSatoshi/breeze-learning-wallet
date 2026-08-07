export const SATS_PER_BTC = 100_000_000;

// Format a sat amount as fiat using the given rate (price of 1 BTC in fiat).
// Falls back to a plain numeric string with the currency code if Intl can't
// handle the currency (e.g. a non-ISO code from the SDK).
export function formatFiat({
  sats,
  ratePerBtc,
  currency = "USD",
  fractionDigits = 2,
}: {sats: number; ratePerBtc: number; currency?: string; fractionDigits?: number}): string {
  const fiat = (sats / SATS_PER_BTC) * ratePerBtc;
  const fractions = fiat === 0 ? 2 : fractionDigits;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: fractions,
      maximumFractionDigits: fractions,
    }).format(fiat);
  } catch {
    return `${fiat.toFixed(fractionDigits)} ${currency}`;
  }
}