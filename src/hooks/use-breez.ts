import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBalance,
  getNodeState,
  listPayments,
  prepareSend,
  executeSend,
  prepareReceiveLightning,
  executeReceive,
  fetchLightningLimits,
  parseInput,
  getBitcoinAddress,
  listRefundables,
  listPaymentsWaitingFeeAcceptance,
  recommendedFees,
  prepareRefund,
  executeRefund,
  fetchProposedFees,
  acceptProposedFees,
  type PrepareSendResult,
  type PrepareReceiveResult,
} from "@/lib/lightning/breez-service";
import type { FetchPaymentProposedFeesResponse } from "@breeztech/breez-sdk-liquid";
import type { LightningBalance, Payment } from "@/lib/lightning/types";

export const breezKeys = {
  all: ["breez"] as const,
  balance: () => [...breezKeys.all, "balance"] as const,
  nodeState: () => [...breezKeys.all, "nodeState"] as const,
  payments: () => [...breezKeys.all, "payments"] as const,
};

export function useLightningBalance(enabled: boolean = true) {
  return useQuery<LightningBalance>({
    queryKey: breezKeys.balance(),
    queryFn: async () => {
      const balance = await getBalance();
      return {
        channelsBalanceMsat: balance.totalSats * 1000,
        maxPayableMsat: balance.spendableSats * 1000,
        maxReceivableMsat: balance.receivableSats * 1000,
      };
    },
    enabled,
    refetchInterval: enabled ? 60000 : false,
    staleTime: 10000,
  });
}

export function useNodeState() {
  return useQuery({
    queryKey: breezKeys.nodeState(),
    queryFn: getNodeState,
    refetchInterval: 30000,
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
    mutationFn: async ({ destination, amountSat }: { destination: string; amountSat?: number }) => {
      return await prepareSend(destination, amountSat);
    },
  });
}

export function useExecuteSend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prepareResponse: PrepareSendResult) => {
      return await executeSend(prepareResponse);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.balance() });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function usePrepareReceive() {
  return useMutation({
    mutationFn: async (amountSats: number) => {
      return await prepareReceiveLightning(amountSats);
    },
  });
}

export function useExecuteReceive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prepareResponse,
      description,
    }: {
      prepareResponse: PrepareReceiveResult;
      description: string;
    }) => {
      return await executeReceive(prepareResponse, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useLightningLimits(enabled: boolean = true) {
  return useQuery({
    queryKey: [...breezKeys.all, "lightningLimits"] as const,
    queryFn: fetchLightningLimits,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useParseInput() {
  return useMutation({
    mutationFn: async (input: string) => parseInput(input),
  });
}

export function useRefundables(enabled: boolean = true) {
  return useQuery({
    queryKey: [...breezKeys.all, "refundables"] as const,
    queryFn: listRefundables,
    enabled,
    refetchInterval: 60000,
  });
}

export function usePaymentsWaitingFeeAcceptance(enabled: boolean = true) {
  return useQuery({
    queryKey: [...breezKeys.all, "waitingFeeAcceptance"] as const,
    queryFn: listPaymentsWaitingFeeAcceptance,
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

export function usePrepareRefund() {
  return useMutation({
    mutationFn: async (req: {
      swapAddress: string;
      refundAddress: string;
      feeRateSatPerVbyte: number;
    }) => prepareRefund(req.swapAddress, req.refundAddress, req.feeRateSatPerVbyte),
  });
}

export function useExecuteRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: {
      swapAddress: string;
      refundAddress: string;
      feeRateSatPerVbyte: number;
    }) => executeRefund(req.swapAddress, req.refundAddress, req.feeRateSatPerVbyte),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...breezKeys.all, "refundables"] as const });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useFetchProposedFees() {
  return useMutation({
    mutationFn: async (swapId: string) => fetchProposedFees(swapId),
  });
}

export function useAcceptProposedFees() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (response: FetchPaymentProposedFeesResponse) =>
      acceptProposedFees(response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...breezKeys.all, "waitingFeeAcceptance"] as const });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useGetBitcoinAddress() {
  return useMutation({
    mutationFn: async () => {
      return await getBitcoinAddress();
    },
  });
}

export function useRefreshLightning() {
  const queryClient = useQueryClient();

  return {
    refresh: async () => {
      console.log("🔄 Invalidating all Breez queries...");
      await queryClient.invalidateQueries({ queryKey: breezKeys.all });
      await queryClient.refetchQueries({ queryKey: breezKeys.all });
      console.log("✅ Breez queries refreshed");
    },
    isRefetching: queryClient.isFetching({ queryKey: breezKeys.all }) > 0,
  };
}
