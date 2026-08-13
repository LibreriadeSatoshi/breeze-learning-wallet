import { useBalance, useConversionLimits, usePayments, useRefreshBreez, useToggleStableBalance, useUnclaimedDeposits, useUserSettings } from "./use-breez";
import { useFiat } from "./use-fiat";

export const useWalletData = (isReady: boolean) => {
  const { data: balances, isLoading: balanceLoading } = useBalance(isReady);
  const { data: payments = [], isLoading: paymentsLoading } =
    usePayments(isReady);
  const { data: unclaimedDeposits = [] } = useUnclaimedDeposits(isReady);
  const { refresh } = useRefreshBreez();
  const {
    rate: fiatRate,
    currency: selectedCurrency,
    estableRate,
  } = useFiat(isReady);
  const { mutateAsync: toggleStableAsync, isPending: isSwapPending, isError: isSwapError} =
    useToggleStableBalance();
  const { data: conversionLimits, isLoading: convertionLimitLoading } =
    useConversionLimits(isReady);
  const rejectedDeposits = unclaimedDeposits.filter((d) => d.claimError);
  const { data: userSettings, isLoading: userSettingsLoading } =
    useUserSettings(isReady);

  return {
    balances,
    balanceLoading,
    payments,
    paymentsLoading,
    rejectedDeposits,
    fiatRate,
    selectedCurrency,
    estableRate,
    toggleStableAsync,
    isSwapPending,
    isSwapError,
    conversionLimits,
    convertionLimitLoading,
    userSettings,
    userSettingsLoading,
    refresh,
    unclaimedDeposits,
  };
};