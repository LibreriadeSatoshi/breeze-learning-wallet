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
    <span className={className}>
      {showBalance ? children : <span className="tracking-wider">{MASK}</span>}
    </span>
  );
}

interface BalanceDisplayProps {
  readonly balanceSat: number;
  readonly fiatRate?: number;
  readonly usdRate?: number;
  readonly fiatCurrency?: string;
  readonly token?: any;
  readonly isStableBalance?: boolean;
}

export function formatTokenBalance({amount, decimals = 6, fraction = 2}: {amount: string, decimals?: number, fraction?: number}) {
  if (!amount) return "$0.00";
  const numericBalance = Number(amount) / Math.pow(10, decimals);
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction
  }).format(numericBalance);
}

export function estimateSats(amount: number, rate: number, decimals = 6) {
  const tokenBalanceNum = Number(amount || 0) / Math.pow(10, decimals);
  
  return Math.round((tokenBalanceNum * 100_000_000) / rate);
}

export function BalanceDisplay({ 
  balanceSat, 
  fiatRate, 
  usdRate,
  fiatCurrency, 
  isStableBalance, 
  token
}: BalanceDisplayProps) {
  const showBalance = useWalletStore((e) => e.showBalance);
  const onToggleVisibility = useWalletStore((e) => e.toggleBalanceVisibility);

  const primaryAmount = isStableBalance 
    ? formatTokenBalance({amount: token?.balance}).replace("$", "")
    : balanceSat.toLocaleString();

  const primaryTicker = isStableBalance 
    ? (token?.tokenMetadata?.ticker || "USDB") 
    : "sats";

    let secondaryText = "";

  if (fiatRate !== undefined && fiatRate > 0 && fiatCurrency && usdRate !== undefined && usdRate > 0) {
    if (isStableBalance) {
      const isToken = token !== undefined && token !== 0;
      const equivalentSats = isToken ? estimateSats(token?.balance, usdRate, token?.tokenMetadata?.decimals) : balanceSat;
      secondaryText = isToken ?  `≈ ${equivalentSats.toLocaleString()} sats` : `≈ ${equivalentSats.toLocaleString()} change`;
    } else {
      secondaryText = `≈ ${formatFiat(balanceSat, fiatRate, fiatCurrency)}`;
    }
  }

  return (
    <div className="text-center py-8">
      <div className="mb-2 flex flex-row justify-center items-end">
        <button 
          onClick={onToggleVisibility} 
          className="mb-3 mr-3 focus:outline-none"
          aria-label={showBalance ? "hide balance" : "show balance"}
        >
          {showBalance ? <Eye className="min-w-6 h-6" /> : <EyeOff className="min-w-6 h-6" />}
        </button>

        <SensitiveAmount className="text-5xl font-bold">
          {primaryAmount}
        </SensitiveAmount>
        
        <span className="text-2xl text-gray-600 dark:text-gray-400 ml-2 select-none">
          {primaryTicker}
        </span>
      </div>

      {secondaryText && (
        <SensitiveAmount className="text-base text-gray-500 dark:text-gray-400 font-medium block mt-1">
          {secondaryText}
        </SensitiveAmount>
      )}
    </div>
  );
}
