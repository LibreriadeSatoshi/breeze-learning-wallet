import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBalance,
  getNodeState,
  listPayments,
  prepareSend,
  executeSend,
  receiveLightning,
  parseInput,
  getBitcoinAddress,
  listUnclaimedDeposits,
  claimDeposit,
  refundDeposit,
  recommendedFees,
  prepareLnurlPay,
  executeLnurlPay,
  checkLightningAddressAvailable,
  registerLightningAddress,
  getLightningAddress,
  deleteLightningAddress,
  listFiatCurrencies,
  listFiatRates,
  type PrepareSendResult,
  type PrepareLnurlPayResult,
  disableStableBalance,
  enableStableBalance,
  fetchConvertionLimit,
  estimateSwapFee,
  getUserSettings,
} from "@/lib/lightning/breez-service";
import type {
  LnurlPayRequestDetails,
  Fee,
} from "@breeztech/breez-sdk-spark";
import type { Payment } from "@/lib/lightning/types";

interface UseSwapFeeParams { 
  enabled?: boolean; 
}

const breezKeys = {
  all: ["breez"] as const,
  balance: () => [...breezKeys.all, "balance"] as const,
  nodeState: () => [...breezKeys.all, "nodeState"] as const,
  payments: () => [...breezKeys.all, "payments"] as const,
  unclaimedDeposits: () => [...breezKeys.all, "unclaimedDeposits"] as const,
  lightningAddress: () => [...breezKeys.all, "lightningAddress"] as const,
  fiatCurrencies: () => [...breezKeys.all, "fiatCurrencies"] as const,
  fiatRates: () => [...breezKeys.all, "fiatRates"] as const,
  convertionLimit: () => [...breezKeys.all, "convertionLimit"] as const,
  estimatedSwapFee: () => [...breezKeys.all, "estimatedFees"] as const,
  userSettings: () => [...breezKeys.all, "userSettings"] as const
};

export function useBalance(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.balance(),
    queryFn: getBalance,
    enabled,
    refetchInterval: enabled ? 60000 : false,
    staleTime: 10000,
  });
}

export function useToggleStableBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enable, label = 'USDB' }: { enable: boolean; label?: string }) => {
      if (enable) {
        await enableStableBalance(label);
      } else {
        await disableStableBalance();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.balance() }); 
    },
    onError: (error) => {
      console.error("Error toggling stable balance: ", error);
    }
  });
}

export function useConvertionLimit() {
  return useQuery({
    queryKey: breezKeys.convertionLimit(),
    queryFn: fetchConvertionLimit,
    refetchInterval: 60000,
    staleTime: 10000,
  });
}

export function useSwapFee({ 
  enabled = true, 
}: UseSwapFeeParams) {
  return useQuery({
    queryKey: [
      ...breezKeys.estimatedSwapFee(),
    ],
    queryFn: () => estimateSwapFee(),
    enabled,
    refetchInterval: 60000,
    staleTime: 10000
  });
}

export function useUserSettings(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.userSettings(),
    queryFn: getUserSettings,
    enabled,
    refetchInterval: enabled ? 60000 : false,
    staleTime: 10000,
  });
}

export function usePayments(enabled: boolean = true) {
  return useQuery<Payment[]>({
    queryKey: breezKeys.payments(),
    queryFn: listPayments,
    enabled,
    refetchInterval: enabled ? 60000 : false,
    staleTime: 10000,
  });
}

export function usePrepareSend() {
  return useMutation({
    mutationFn: async ({
      destination,
      amountSat,
    }: {
      destination: string;
      amountSat?: number;
    }) => prepareSend(destination, amountSat),
  });
}

export function useExecuteSend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prepareResponse: PrepareSendResult) =>
      executeSend(prepareResponse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.balance() });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useReceiveLightning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amountSat,
      description,
    }: {
      amountSat: number;
      description: string;
    }) => receiveLightning(amountSat, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useParseInput() {
  return useMutation({
    mutationFn: async (input: string) => parseInput(input),
  });
}

export function usePrepareLnurlPay() {
  return useMutation({
    mutationFn: async ({
      payRequest,
      amountSat,
      comment,
    }: {
      payRequest: LnurlPayRequestDetails;
      amountSat: number;
      comment?: string;
    }) => prepareLnurlPay(payRequest, amountSat, comment),
  });
}

export function useExecuteLnurlPay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prepareResponse: PrepareLnurlPayResult) =>
      executeLnurlPay(prepareResponse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.balance() });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useUnclaimedDeposits(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.unclaimedDeposits(),
    queryFn: listUnclaimedDeposits,
    enabled,
    refetchInterval: 60000,
  });
}

export function useRecommendedFees(enabled: boolean = true) {
  return useQuery({
    queryKey: [...breezKeys.all, "recommendedFees"] as const,
    queryFn: recommendedFees,
    enabled,
    staleTime: 60_000,
  });
}

export function useRefundDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      txid,
      vout,
      destinationAddress,
      fee,
    }: {
      txid: string;
      vout: number;
      destinationAddress: string;
      fee: Fee;
    }) => refundDeposit(txid, vout, destinationAddress, fee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.unclaimedDeposits() });
    },
  });
}

export function useFiatCurrencies(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.fiatCurrencies(),
    queryFn: listFiatCurrencies,
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

export function useFiatRates(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.fiatRates(),
    queryFn: listFiatRates,
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
  });
}

export function useGetBitcoinAddress() {
  return useMutation({
    mutationFn: async () => getBitcoinAddress(),
  });
}

export function useLightningAddress(enabled: boolean = true) {
  return useQuery({
    queryKey: breezKeys.lightningAddress(),
    queryFn: getLightningAddress,
    enabled,
    staleTime: 60_000,
  });
}

export function useCheckLightningAddressAvailable() {
  return useMutation({
    mutationFn: async (username: string) =>
      checkLightningAddressAvailable(username),
  });
}

export function useRegisterLightningAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      description,
    }: {
      username: string;
      description?: string;
    }) => registerLightningAddress(username, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.lightningAddress() });
    },
  });
}

export function useRefreshBreez() {
  const queryClient = useQueryClient();
  return {
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: breezKeys.all });
      await queryClient.refetchQueries({ queryKey: breezKeys.all });
    },
    isRefetching: queryClient.isFetching({ queryKey: breezKeys.all }) > 0,
  };
}
