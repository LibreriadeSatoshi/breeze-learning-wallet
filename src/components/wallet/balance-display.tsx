'use client';

import { useT } from '@/lib/i18n/hook';
import { usdbTicker } from '@/lib/lightning/breez-service';
import { Balances } from '@/lib/lightning/types';
import { convertSatsToFiat } from '@/lib/wallet/format-fiat';
import { DEFAULT_FIAT_CURRENCY } from '@/lib/wallet/prefs';
import { formatSats, formatWithFigureGrouping } from '@/lib/wallet/format-number';
import { useWalletStore } from '@/store/wallet-store';
import { Eye, EyeClosed } from 'iconoir-react';
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
      {showBalance ? children : MASK}
    </span>
  );
}

interface BalanceDisplayProps {
  readonly balanceSat: number;
  readonly fiatRate?: number;
  readonly usdRate?: number;
  readonly fiatCurrency?: string;
  readonly token: Balances["tokenUSDB"];
  readonly isStableBalance: boolean;
}

export function formatTokenToUSD({amount, decimals = 6, fraction = 2}: {amount: number | undefined, decimals?: number, fraction?: number}) {
  if (amount === undefined || !amount || amount === 0) return "$0.00";
  const numericBalance = Number(amount) / Math.pow(10, decimals);
  
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: DEFAULT_FIAT_CURRENCY,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction
  });
  return formatWithFigureGrouping(formatter, numericBalance);
}

export function estimateSats(amount: number, usdRate?: number, decimals = 6) {
  if (usdRate === 0 || usdRate === undefined) return 0;

  const tokenBalanceNum = Number(amount || 0) / Math.pow(10, decimals);
  
  return Math.round((tokenBalanceNum * 100_000_000) / usdRate);
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
  const t = useT();
  let changeText = t("home.balance.change");

  const primaryAmount = getPrimaryAmount(balanceSat, token, isStableBalance);
  const primaryTicker = getPrimaryTicker(token, isStableBalance);
  let secondaryText = getSecondaryText(balanceSat, isStableBalance, changeText, fiatCurrency, fiatRate, usdRate, token);

  return (
    <div className="py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <SensitiveAmount className="font-mono text-h1 font-medium tabular-nums text-heading sm:text-display">
            {primaryAmount}
          </SensitiveAmount>
          <span className="ism-label select-none">
            {primaryTicker}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleVisibility}
          className="inline-flex min-h-control min-w-[44px] flex-none items-center justify-center rounded text-fg-muted transition-colors duration-fast hover:bg-raised hover:text-fg"
          aria-label={showBalance ? t("home.balance.hide") : t("home.balance.show")}
        >
          {showBalance ? <Eye aria-hidden="true" className="h-6 w-6" /> : <EyeClosed aria-hidden="true" className="h-6 w-6" />}
        </button>
      </div>

      {secondaryText && (
        <SensitiveAmount className="mt-2 block font-mono text-body-sm tabular-nums text-fg-muted">
          {secondaryText}
        </SensitiveAmount>
      )}
    </div>
  );
}

function getPrimaryAmount(balanceSat: number, token: Balances["tokenUSDB"], isStableBalance: boolean = false) {
  let primaryAmount = "";

  if (isStableBalance) {
    primaryAmount = formatTokenToUSD({ amount: token?.balance }).replace("$", "");
  } else {
    primaryAmount = formatSats(balanceSat);
  }
  return primaryAmount;
}

function getPrimaryTicker(token: Balances["tokenUSDB"], isStableBalance: boolean = false) {
  return isStableBalance 
    ? (token?.tokenMetadata?.ticker || usdbTicker) 
    : "sats";
}

function getSecondaryText(balanceSat: number, isStableBalance: boolean, changeText: string, fiatCurrency: string = "", fiatRate?: number, usdRate?: number, token?: Balances["tokenUSDB"],) {
    if (fiatRate === undefined || fiatRate <= 0 || usdRate === undefined || usdRate <= 0) {
      return ""
    }

    if (isStableBalance) {
      const isToken = token !== undefined;
      const equivalentSats = isToken ? estimateSats(token?.balance, usdRate, token?.tokenMetadata?.decimals) : balanceSat;
      return isToken ?  `≈ ${equivalentSats} sats` : `≈ ${equivalentSats} ${changeText}`;
    } else {
      return `≈ ${convertSatsToFiat({ sats: balanceSat, ratePerBtc: fiatRate, currency: fiatCurrency })}`;
    }
}