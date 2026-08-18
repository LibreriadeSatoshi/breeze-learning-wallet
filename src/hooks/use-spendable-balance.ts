"use client";

import { useBalance, useUserSettings } from "@/hooks/use-breez";
import { useFiat } from "@/hooks/use-fiat";
import { usdbTicker } from "@/lib/lightning/breez-service";
import { estimateSats } from "@/components/wallet/balance-display";

/** Total the wallet can spend, folding a USDB stable balance back into sats. */
export function useSpendableBalance() {
  const { data: balances } = useBalance(true);
  const { estableRate: usdRate } = useFiat(true);
  const { data: userSettings } = useUserSettings(true);

  const tokenUSDB = balances?.tokenUSDB;
  const totalBalanceSats =
    (estimateSats(tokenUSDB?.balance || 0, usdRate, tokenUSDB?.tokenMetadata?.decimals) || 0) +
    (balances?.totalSats || 0);

  return {
    usdRate,
    totalBalanceSats,
    isStableBalance: userSettings?.stableBalanceActiveLabel === usdbTicker,
  };
}
