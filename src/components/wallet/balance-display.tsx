'use client';

import { formatFiat } from '@/lib/wallet/format-fiat';
import { useWalletStore } from '@/store/wallet-store';
import { Eye, EyeOff } from 'lucide-react';
import React from 'react';

interface SensitiveAmountProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

const MASK = "*****";

export function SensitiveAmount({
  children,
  className = "",
}: SensitiveAmountProps) {
  const showBalance = useWalletStore((e) => e.showBalance);

  return (
    <span className={`${className}`}>
      {showBalance ? children : <span className="tracking-wider">{MASK}</span>}
    </span>
  );
}

interface BalanceDisplayProps {
  balanceSat: number;
  fiatRate?: number;
  fiatCurrency?: string;
}

export function BalanceDisplay({ balanceSat, fiatRate, fiatCurrency }: BalanceDisplayProps) {
  const showBalance = useWalletStore((e) => e.showBalance);
  const onToggleVisibility = useWalletStore((e) => e.toggleBalanceVisibility);
  
  const fiat =
    fiatRate !== undefined && fiatCurrency
      ? formatFiat(balanceSat, fiatRate, fiatCurrency)
      : null;

  return (
    <div className="text-center py-8">
      <div className="mb-2 flex flex-row justify-center items-end">
        {showBalance ? <Eye onClick={onToggleVisibility} className='mb-3 mr-3 min-w-6'/> : <EyeOff onClick={onToggleVisibility} className='mb-3 mr-3 min-w-6'/> }
        <SensitiveAmount className="text-5xl font-bold">
          <span className="text-5xl font-bold">
            {balanceSat.toLocaleString()}
          </span>
        </SensitiveAmount>
        <span className="text-2xl text-gray-600 dark:text-gray-400 ml-2">sats</span>
      </div>
      {fiat && (
        <SensitiveAmount className="text-base text-gray-200 dark:text-gray-300" >
          ≈ {fiat}
        </SensitiveAmount>
      )}
    </div>
  );
}
