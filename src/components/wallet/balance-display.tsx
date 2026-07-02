'use client';

import { formatFiat } from '@/lib/wallet/format-fiat';

interface BalanceDisplayProps {
  balanceSat: number;
  fiatRate?: number;
  fiatCurrency?: string;
}

export function BalanceDisplay({ balanceSat, fiatRate, fiatCurrency }: BalanceDisplayProps) {
  const fiat =
    fiatRate !== undefined && fiatCurrency
      ? formatFiat(balanceSat, fiatRate, fiatCurrency)
      : null;

  return (
    <div className="text-center py-8">
      <div className="mb-2">
        <span className="text-5xl font-bold">{balanceSat.toLocaleString()}</span>
        <span className="text-2xl text-gray-600 dark:text-gray-400 ml-2">sats</span>
      </div>
      {fiat && (
        <div className="text-base text-gray-200 dark:text-gray-300">≈ {fiat}</div>
      )}
    </div>
  );
}

