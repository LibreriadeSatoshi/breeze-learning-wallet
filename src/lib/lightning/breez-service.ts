import type { SdkEvent } from "./sdk-events";
import type {
  PrepareSendResponse,
  PrepareReceiveResponse,
  LightningPaymentLimitsResponse,
  InputType,
  RefundableSwap,
  PrepareRefundResponse,
  RefundResponse,
  FetchPaymentProposedFeesResponse,
  RecommendedFees,
  Payment,
} from "@breeztech/breez-sdk-liquid";

type LiquidSdk = Awaited<ReturnType<typeof import("@breeztech/breez-sdk-liquid").connect>>;

let sdk: LiquidSdk | null = null;
let eventListenerId: string | null = null;
let isInitializing: boolean = false;
let cachedApiKey: string | null = null;

type EventCallback = (event: SdkEvent) => void;
const eventCallbacks: EventCallback[] = [];

async function getBreezApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const response = await fetch('/api/breez/config');
  if (!response.ok) {
    throw new Error('Failed to fetch Breez API configuration');
  }

  const data = await response.json();
  if (!data.apiKey) {
    throw new Error('BREEZ_API_KEY is not configured. Please add it to your environment variables.');
  }

  cachedApiKey = data.apiKey;
  return data.apiKey;
}

export interface BreezLiquidConfig {
  network: "mainnet" | "testnet" | "regtest";
  workingDir?: string;
  mnemonic: string;
}

export async function initBreez(config: BreezLiquidConfig): Promise<void> {
  if (isInitializing) {
    console.log("⏳ SDK initialization already in progress...");
    return;
  }

  if (sdk) {
    console.log("✅ SDK already initialized");
    return;
  }

  isInitializing = true;

  try {
    const apiKey = await getBreezApiKey();

    console.log("⚡ Initializing Breez SDK Liquid...");
    console.log("📡 Network:", config.network);

    const breezSdkModule = await import("@breeztech/breez-sdk-liquid");

    if (
      breezSdkModule.default &&
      typeof breezSdkModule.default === "function"
    ) {
      await breezSdkModule.default();
    }

    const { defaultConfig, connect } = breezSdkModule;

    const sdkConfig = defaultConfig(config.network, apiKey);
    if (config.workingDir) {
      sdkConfig.workingDir = config.workingDir;
    }

    if (!config.mnemonic) {
      throw new Error("Mnemonic is required to initialize the wallet");
    }

    sdk = await connect({
      mnemonic: config.mnemonic,
      config: sdkConfig,
    });

    console.log("✅ Breez SDK Liquid initialized");

    await setupEventListener();

    isInitializing = false;
  } catch (error) {
    isInitializing = false;
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Failed to initialize Breez SDK Liquid:", message);
    throw error;
  }
}

async function setupEventListener(): Promise<void> {
  if (!sdk || eventListenerId) {
    return;
  }

  try {
    const listener = {
      onEvent: (event: SdkEvent) => {
        setTimeout(() => {
          eventCallbacks.forEach((callback) => {
            try {
              callback(event);
            } catch (error) {
              console.error("Error in event callback:", error);
            }
          });
        }, 0);
      },
    };

    eventListenerId = await sdk.addEventListener(listener);
  } catch (error) {
    console.error("Failed to setup event listener:", error);
  }
}

export function onSdkEvent(callback: EventCallback): () => void {
  eventCallbacks.push(callback);

  return () => {
    const index = eventCallbacks.indexOf(callback);
    if (index > -1) {
      eventCallbacks.splice(index, 1);
    }
  };
}

export async function getNodeState(): Promise<{ id?: string } | null> {
  if (!sdk) {
    return null;
  }

  try {
    const info = await sdk.getInfo();
    return { id: info.walletInfo?.pubkey };
  } catch (error) {
    console.error("Failed to get node state:", error);
    return null;
  }
}

export type PrepareReceiveResult = PrepareReceiveResponse;

export async function prepareReceiveLightning(amountSats: number): Promise<PrepareReceiveResult> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.prepareReceivePayment({
    paymentMethod: "bolt11Invoice",
    amount: { type: "bitcoin", payerAmountSat: amountSats },
  });
}

export async function executeReceive(
  prepareResponse: PrepareReceiveResult,
  description: string,
): Promise<{ paymentRequest: string; expiresAt: number; fee: number }> {
  if (!sdk) throw new Error("Wallet not ready.");
  const response = await sdk.receivePayment({
    prepareResponse,
    description: description || "Lightning payment",
  });
  return {
    paymentRequest: response.destination,
    expiresAt: Date.now() + 3600 * 1000,
    fee: prepareResponse.feesSat ?? 0,
  };
}

export async function fetchLightningLimits(): Promise<LightningPaymentLimitsResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.fetchLightningLimits();
}

export async function parseInput(input: string): Promise<InputType> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.parse(input);
}

// --- Recovery: refundable swaps + payments waiting for fee acceptance ---

export async function listRefundables(): Promise<RefundableSwap[]> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.listRefundables();
}

export async function listPaymentsWaitingFeeAcceptance(): Promise<Payment[]> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.listPayments({ states: ["waitingFeeAcceptance"] });
}

export async function recommendedFees(): Promise<RecommendedFees> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.recommendedFees();
}

export async function prepareRefund(
  swapAddress: string,
  refundAddress: string,
  feeRateSatPerVbyte: number,
): Promise<PrepareRefundResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.prepareRefund({ swapAddress, refundAddress, feeRateSatPerVbyte });
}

export async function executeRefund(
  swapAddress: string,
  refundAddress: string,
  feeRateSatPerVbyte: number,
): Promise<RefundResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.refund({ swapAddress, refundAddress, feeRateSatPerVbyte });
}

export async function fetchProposedFees(swapId: string): Promise<FetchPaymentProposedFeesResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.fetchPaymentProposedFees({ swapId });
}

export async function acceptProposedFees(
  response: FetchPaymentProposedFeesResponse,
): Promise<void> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.acceptPaymentProposedFees({ response });
}

export async function getBitcoinAddress(): Promise<{
  address: string;
  paymentRequest: string;
  fee: number;
}> {
  if (!sdk) {
    throw new Error("Wallet not ready.");
  }

  const prepareResponse = await sdk.prepareReceivePayment({
    paymentMethod: "bitcoinAddress",
  });

  const response = await sdk.receivePayment({ prepareResponse });

  return {
    address: response.destination,
    paymentRequest: response.destination,
    fee: prepareResponse.feesSat ?? 0,
  };
}

export type PrepareSendResult = PrepareSendResponse;

export async function prepareSend(
  destination: string,
  amountSat?: number,
): Promise<PrepareSendResult> {
  if (!sdk) {
    throw new Error("Wallet not ready.");
  }

  const request = amountSat
    ? { destination, amount: { type: "bitcoin" as const, receiverAmountSat: amountSat } }
    : { destination };

  return sdk.prepareSendPayment(request);
}

export async function executeSend(prepareResponse: PrepareSendResult): Promise<unknown> {
  if (!sdk) {
    throw new Error("Wallet not ready.");
  }

  try {
    return await sdk.sendPayment({ prepareResponse });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";

    if (message.includes("insufficient")) {
      throw new Error("Insufficient balance to complete payment");
    } else if (message.includes("route")) {
      throw new Error("Unable to find route to destination");
    } else if (message.includes("timeout")) {
      throw new Error("Payment timed out. Please try again.");
    }

    throw new Error(message);
  }
}

export async function listPayments(): Promise<Array<{
  id: string;
  paymentType: "sent" | "received";
  paymentTime: number;
  amountMsat: number;
  feeMsat: number;
  status: "pending" | "complete" | "failed";
  description: string;
  bolt11: string | undefined;
  preimage: string | undefined;
}>> {
  if (!sdk) {
    return [];
  }

  try {
    const payments = await sdk.listPayments({});

    return payments.map((p) => {
      const lightning = p.details.type === "lightning" ? p.details : null;
      return {
        id: p.txId ?? "",
        paymentType: p.paymentType === "send" ? ("sent" as const) : ("received" as const),
        paymentTime: p.timestamp,
        amountMsat: Number(p.amountSat) * 1000,
        feeMsat: Number(p.feesSat) * 1000,
        status:
          p.status === "complete"
            ? ("complete" as const)
            : p.status === "failed" || p.status === "timedOut"
            ? ("failed" as const)
            : ("pending" as const),
        description: p.details.description,
        bolt11: lightning?.invoice,
        preimage: lightning?.preimage,
      };
    });
  } catch (error) {
    console.error("Failed to list payments:", error);
    return [];
  }
}

export async function getBalance(): Promise<{
  totalSats: number;
  spendableSats: number;
  receivableSats: number;
}> {
  if (!sdk) {
    return { totalSats: 0, spendableSats: 0, receivableSats: 0 };
  }

  try {
    const info = await sdk.getInfo();
    const balanceSat = info.walletInfo?.balanceSat ?? 0;
    return {
      totalSats: balanceSat,
      spendableSats: balanceSat,
      receivableSats: 0,
    };
  } catch (error) {
    console.error("Failed to get balance:", error);
    return { totalSats: 0, spendableSats: 0, receivableSats: 0 };
  }
}

export async function disconnectBreez(): Promise<void> {
  if (sdk) {
    try {
      await sdk.disconnect();
      sdk = null;
    } catch (error) {
      console.error("Failed to disconnect Breez SDK:", error);
    }
  }
}

export function isBreezInitialized(): boolean {
  return sdk !== null;
}
