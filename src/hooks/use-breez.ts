import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBalance,
  getNodeState,
  listPayments,
  sendPayment,
  receivePayment,
  getBitcoinAddress,
} from "@/lib/lightning/breez-service";
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

export function useSendPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoice: string) => {
      return await sendPayment(invoice);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: breezKeys.balance() });
      queryClient.invalidateQueries({ queryKey: breezKeys.payments() });
    },
  });
}

export function useReceivePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      amountSats,
      description,
    }: {
      amountSats: number;
      description: string;
    }) => {
      return await receivePayment(amountSats, description);
    },
    onSuccess: () => {
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
