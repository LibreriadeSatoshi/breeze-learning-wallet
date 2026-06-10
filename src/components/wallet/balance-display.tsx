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

interface BalanceCardProps {
  label: string;
  amountSat: number;
  variant?: 'default' | 'primary' | 'success';
}

export function BalanceCard({ label, amountSat, variant = 'default' }: BalanceCardProps) {
  const sats = amountSat;

  const variants = {
    default: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    primary: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
  };

  return (
    <div className={`p-4 rounded-lg border ${variants[variant]}`}>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{sats.toLocaleString()}</div>
      <div className="text-xs text-gray-500">sats</div>
    </div>
  );
}
