import type { SdkEvent } from "./sdk-events";
import type {
  InputType,
  DepositInfo,
  RecommendedFees,
  PrepareSendPaymentResponse,
  PrepareLnurlPayResponse,
  LnurlPayResponse,
  LnurlPayRequestDetails,
  SendPaymentResponse,
  Fee,
  LightningAddressInfo,
  FiatCurrency,
  Rate,
  Payment as SdkPayment,
  BuyBitcoinRequest,
  BuyBitcoinResponse,
} from "@breeztech/breez-sdk-spark";
import type { Payment } from "./types";

type SparkSdk = Awaited<ReturnType<typeof import("@breeztech/breez-sdk-spark").connect>>;

let sdk: SparkSdk | null = null;
let eventListenerId: string | null = null;
let isInitializing: boolean = false;
let cachedApiKey: string | null = null;
// Mnemonic the running SDK is init'd for; used to detect wallet switches.
let activeMnemonic: string | null = null;

type EventCallback = (event: SdkEvent) => void;
const eventCallbacks: EventCallback[] = [];

async function getBreezApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const response = await fetch("/api/breez/config");
  if (!response.ok) {
    throw new Error("Failed to fetch Breez API configuration");
  }

  const data = await response.json();
  if (!data.apiKey) {
    throw new Error(
      "BREEZ_API_KEY is not configured. Please add it to your environment variables.",
    );
  }

  cachedApiKey = data.apiKey;
  return data.apiKey;
}

export interface BreezSparkConfig {
  network: "mainnet" | "regtest";
  storageDir?: string;
  mnemonic: string;
  lnurlDomain?: string;
  claimLeewaySatPerVbyte?: number;
}

export async function initBreez(config: BreezSparkConfig): Promise<void> {
  if (isInitializing) return;
  if (sdk && activeMnemonic === config.mnemonic) return;
  if (sdk) await disconnectBreez();

  isInitializing = true;

  try {
    const apiKey = await getBreezApiKey();

    const breezSdkModule = await import("@breeztech/breez-sdk-spark");
    if (
      breezSdkModule.default &&
      typeof breezSdkModule.default === "function"
    ) {
      await breezSdkModule.default();
    }

    const { defaultConfig, connect } = breezSdkModule;

    const sdkConfig = defaultConfig(config.network);
    sdkConfig.apiKey = apiKey;
    if (config.lnurlDomain) sdkConfig.lnurlDomain = config.lnurlDomain;
    if (config.claimLeewaySatPerVbyte !== undefined) {
      sdkConfig.maxDepositClaimFee = {
        type: "networkRecommended",
        leewaySatPerVbyte: config.claimLeewaySatPerVbyte,
      };
    }

    if (!config.mnemonic) {
      throw new Error("Mnemonic is required to initialize the wallet");
    }

    sdk = await connect({
      config: sdkConfig,
      seed: { type: "mnemonic", mnemonic: config.mnemonic },
      storageDir: config.storageDir ?? "scholar-wallet-data",
    });
    activeMnemonic = config.mnemonic;

    await setupEventListener();
  } finally {
    isInitializing = false;
  }
}

async function setupEventListener(): Promise<void> {
  if (!sdk || eventListenerId) return;

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
    if (index > -1) eventCallbacks.splice(index, 1);
  };
}

export async function getNodeState(): Promise<{ id?: string } | null> {
  if (!sdk) return null;
  try {
    const info = await sdk.getInfo({});
    return { id: info.identityPubkey };
  } catch (error) {
    console.error("Failed to get node state:", error);
    return null;
  }
}

export async function getBalance(): Promise<{ totalSats: number }> {
  if (!sdk) return { totalSats: 0 };
  try {
    const info = await sdk.getInfo({});
    return { totalSats: info.balanceSats };
  } catch (error) {
    console.error("Failed to get balance:", error);
    return { totalSats: 0 };
  }
}

export async function parseInput(input: string): Promise<InputType> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.parse(input);
}

export async function receiveLightning(
  amountSats: number,
  description: string,
): Promise<{ paymentRequest: string; expiresAt: number; fee: number }> {
  if (!sdk) throw new Error("Wallet not ready.");
  const result = await sdk.receivePayment({
    paymentMethod: {
      type: "bolt11Invoice",
      amountSats,
      description: description || "Lightning payment",
      expirySecs: 3600,
    },
  });
  return {
    paymentRequest: result.paymentRequest,
    expiresAt: Date.now() + 3600 * 1000,
    fee: Number(result.fee),
  };
}

export async function getBitcoinAddress(): Promise<{
  address: string;
  paymentRequest: string;
  fee: number;
}> {
  if (!sdk) throw new Error("Wallet not ready.");
  const result = await sdk.receivePayment({
    paymentMethod: { type: "bitcoinAddress", newAddress: true },
  });
  return {
    address: result.paymentRequest,
    paymentRequest: result.paymentRequest,
    fee: Number(result.fee),
  };
}

export type PrepareSendResult = PrepareSendPaymentResponse;

export async function prepareSend(
  destination: string,
  amountSat?: number,
): Promise<PrepareSendResult> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.prepareSendPayment({
    paymentRequest: destination,
    amount: amountSat ? BigInt(amountSat) : undefined,
  });
}

export async function executeSend(
  prepareResponse: PrepareSendResult,
): Promise<SendPaymentResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
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

export type PrepareLnurlPayResult = PrepareLnurlPayResponse;

export async function prepareLnurlPay(
  payRequest: LnurlPayRequestDetails,
  amountSat: number,
  comment?: string,
): Promise<PrepareLnurlPayResult> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.prepareLnurlPay({
    amount: BigInt(amountSat),
    payRequest,
    comment,
  });
}

export async function executeLnurlPay(
  prepareResponse: PrepareLnurlPayResult,
): Promise<LnurlPayResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.lnurlPay({ prepareResponse });
}

export async function listUnclaimedDeposits(): Promise<DepositInfo[]> {
  if (!sdk) throw new Error("Wallet not ready.");
  const response = await sdk.listUnclaimedDeposits({});
  return response.deposits;
}

export async function claimDeposit(
  txid: string,
  vout: number,
  maxFee?: Fee,
): Promise<void> {
  if (!sdk) throw new Error("Wallet not ready.");
  await sdk.claimDeposit({ txid, vout, maxFee });
}

export async function refundDeposit(
  txid: string,
  vout: number,
  destinationAddress: string,
  fee: Fee,
): Promise<{ txId: string; txHex: string }> {
  if (!sdk) throw new Error("Wallet not ready.");
  const response = await sdk.refundDeposit({
    txid,
    vout,
    destinationAddress,
    fee,
  });
  return { txId: response.txId, txHex: response.txHex };
}

export async function recommendedFees(): Promise<RecommendedFees> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.recommendedFees();
}

function mapPayment(p: SdkPayment): Payment {
  const lightning = p.details?.type === "lightning" ? p.details : null;
  return {
    id: p.id,
    paymentType: p.paymentType === "send" ? "sent" : "received",
    paymentTime: p.timestamp,
    amountSat: Number(p.amount),
    feeSat: Number(p.fees),
    status:
      p.status === "completed"
        ? "complete"
        : p.status === "failed"
          ? "failed"
          : "pending",
    description: lightning?.description,
    bolt11: lightning?.invoice,
    method: p.method,
  };
}

export async function listPayments(): Promise<Payment[]> {
  if (!sdk) return [];
  try {
    const response = await sdk.listPayments({});
    return response.payments.map(mapPayment);
  } catch (error) {
    console.error("Failed to list payments:", error);
    return [];
  }
}

export async function listFiatCurrencies(): Promise<FiatCurrency[]> {
  if (!sdk) throw new Error("Wallet not ready.");
  const response = await sdk.listFiatCurrencies();
  return response.currencies;
}

export async function listFiatRates(): Promise<Rate[]> {
  if (!sdk) throw new Error("Wallet not ready.");
  const response = await sdk.listFiatRates();
  return response.rates;
}

export async function checkLightningAddressAvailable(username: string): Promise<boolean> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.checkLightningAddressAvailable({ username });
}

export async function registerLightningAddress(
  username: string,
  description?: string,
): Promise<LightningAddressInfo> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.registerLightningAddress({ username, description });
}

export async function getLightningAddress(): Promise<LightningAddressInfo | null> {
  if (!sdk) throw new Error("Wallet not ready.");
  const result = await sdk.getLightningAddress();
  return result ?? null;
}

export async function deleteLightningAddress(): Promise<void> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.deleteLightningAddress();
}

export async function buyBitcoin(
  request: BuyBitcoinRequest,
): Promise<BuyBitcoinResponse> {
  if (!sdk) throw new Error("Wallet not ready.");
  return sdk.buyBitcoin(request);
}

export async function disconnectBreez(): Promise<void> {
  if (sdk) {
    try {
      await sdk.disconnect();
      sdk = null;
      eventListenerId = null;
      activeMnemonic = null;
    } catch (error) {
      console.error("Failed to disconnect Breez SDK:", error);
    }
  }
}

export function isBreezInitialized(): boolean {
  return sdk !== null;
}
