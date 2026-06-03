import { initBreez, getBalance, getNodeState, listPayments } from "./breez-service";
import { useWalletStore } from "@/store/wallet-store";
import { SELECTED_BITCOIN_NETWORK } from "../config";
import type { Payment } from "./types";

export interface InitResult {
  success: boolean;
  error?: string;
  nodeId?: string;
  balance?: { totalSats: number };
  payments?: Payment[];
}

export async function initializeBreezWallet(): Promise<InitResult> {
  try {
    const mnemonic = useWalletStore.getState().getMnemonic();
    if (!mnemonic) {
      throw new Error("Wallet is locked. Unlock it before initializing.");
    }

    await initBreez({
      network: SELECTED_BITCOIN_NETWORK as "mainnet" | "regtest",
      storageDir: "scholar-wallet-data",
      mnemonic,
    });

    const nodeState = await getNodeState();
    const balance = await getBalance();
    const payments = await listPayments();

    return {
      success: true,
      nodeId: nodeState?.id ?? undefined,
      balance,
      payments,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize Breez wallet";
    console.error("Breez initialization failed:", message);
    return { success: false, error: message };
  }
}

export async function syncBreezWallet(): Promise<InitResult> {
  try {
    const nodeState = await getNodeState();
    const balance = await getBalance();
    const payments = await listPayments();

    return {
      success: true,
      nodeId: nodeState?.id,
      balance,
      payments,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync Breez wallet";
    console.error("Breez sync failed:", message);
    return { success: false, error: message };
  }
}
