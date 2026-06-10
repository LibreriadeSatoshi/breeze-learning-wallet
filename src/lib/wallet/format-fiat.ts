const SATS_PER_BTC = 100_000_000;

// Format a sat amount as fiat using the given rate (price of 1 BTC in fiat).
// Falls back to a plain numeric string with the currency code if Intl can't
// handle the currency (e.g. a non-ISO code from the SDK).
export function formatFiat(
  sats: number,
  ratePerBtc: number,
  currency: string,
  fractionDigits: number = 2,
): string {
  const fiat = (sats / SATS_PER_BTC) * ratePerBtc;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(fiat);
  } catch {
    return `${fiat.toFixed(fractionDigits)} ${currency}`;
  }
}
