import type { SdkEvent } from "./sdk-events";

let sdk: any = null;
let eventListenerId: string | null = null;
let isInitializing: boolean = false;
let cachedApiKey: string | null = null;

type EventCallback = (event: SdkEvent) => void;
const eventCallbacks: EventCallback[] = [];

/**
 * Fetches the Breez API key from the server.
 * This keeps the API key out of the client-side bundle.
 */
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

export interface SparkConfig {
  network: "mainnet" | "regtest";
  workingDir?: string;
  mnemonic: string;
}

export async function initBreez(config: SparkConfig): Promise<void> {
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
    // Fetch API key from server to avoid exposing it in client bundle
    const apiKey = await getBreezApiKey();

    console.log("⚡ Initializing Breez SDK...");
    console.log("📡 Network:", config.network);
    console.log("🔑 API Key configured:", !!apiKey);

    const breezSdkModule = await import("@breeztech/breez-sdk-spark");

    console.log("📦 Breez SDK module loaded");

    if (
      breezSdkModule.default &&
      typeof breezSdkModule.default === "function"
    ) {
      console.log("🔧 Calling init() for web environment...");
      await breezSdkModule.default();
      console.log("✅ init() completed");
    }

    const { defaultConfig, connect } = breezSdkModule;

    const networkType = config.network === "mainnet" ? "mainnet" : "regtest";

    console.log("🌐 Using network:", networkType);

    const sdkConfig = defaultConfig(networkType);

    sdkConfig.apiKey = apiKey;

    console.log("⚙️ SDK Config created");

    if (!config.mnemonic) {
      throw new Error("Mnemonic is required to initialize Lightning wallet");
    }

    const seed = {
      type: "mnemonic" as const,
      mnemonic: config.mnemonic,
      passphrase: undefined,
    };

    console.log("🔌 Connecting to Breez SDK...");

    sdk = await connect({
      config: sdkConfig,
      seed: seed,
      storageDir: config.workingDir || "./.data",
    });

    console.log("✅ Breez SDK initialized successfully");
    console.log("📊 SDK instance:", sdk);

    await setupEventListener();

    isInitializing = false;
  } catch (error: any) {
    isInitializing = false;
    console.error("❌ Failed to initialize Breez SDK:", error);
    console.error("Error message:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    throw error;
  }
}

async function setupEventListener(): Promise<void> {
  if (!sdk || eventListenerId) {
    return;
  }

  try {
    class JsEventListener {
      onEvent = (event: any) => {
        console.log("⚡ Breez SDK Event:", event.type);
        if (event.payment) {
          console.log("   Payment ID:", event.payment.id);
        }

        setTimeout(() => {
          eventCallbacks.forEach((callback) => {
            try {
              callback(event);
            } catch (error) {
              console.error("Error in event callback:", error);
            }
          });
        }, 0);
      };
    }

    const eventListener = new JsEventListener();
    eventListenerId = await sdk.addEventListener(eventListener);

    console.log("✅ Event listener registered with ID:", eventListenerId);
  } catch (error) {
    console.error("❌ Failed to setup event listener:", error);
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

export async function getNodeState(): Promise<any | null> {
  if (!sdk) {
    console.warn("⚠️ SDK not initialized, returning null node state");
    return null;
  }

  try {
    const info = await sdk.getInfo({ ensureSynced: false });
    return info;
  } catch (error) {
    console.error("Failed to get node state:", error);
    return null;
  }
}

export async function receivePayment(
  amountSats: number,
  description: string
): Promise<any> {
  if (!sdk) {
    throw new Error(
      "Lightning wallet not ready. Please wait for initialization to complete."
    );
  }

  try {
    const response = await sdk.receivePayment({
      paymentMethod: {
        type: "bolt11Invoice",
        description: description || "Lightning payment",
        amountSats: amountSats,
      },
    });

    if (!response) {
      throw new Error("Failed to generate invoice");
    }

    console.log("✅ Invoice generated:", response);

    return {
      bolt11: response.paymentRequest,
      paymentRequest: response.paymentRequest,
      paymentHash: response.payment?.id,
      amountMsat: amountSats * 1000,
      fee: response.fee || 0,
      description: description,
      expiresAt: Date.now() + 3600 * 1000,
    };
  } catch (error: any) {
    console.error("Receive payment error:", error);

    if (error.message?.includes("amount")) {
      throw new Error("Invalid amount specified");
    } else if (error.message?.includes("capacity")) {
      throw new Error("Insufficient receiving capacity. Open a channel first.");
    }

    throw new Error(
      error.message || "Failed to generate invoice. Please try again."
    );
  }
}

export async function getBitcoinAddress(): Promise<any> {
  if (!sdk) {
    throw new Error(
      "Lightning wallet not ready. Please wait for initialization to complete."
    );
  }

  try {
    console.log("📍 Getting Bitcoin address...");

    const response = await sdk.receivePayment({
      paymentMethod: {
        type: "bitcoinAddress",
      },
    });

    if (!response) {
      throw new Error("Failed to get Bitcoin address");
    }

    console.log("✅ Bitcoin address retrieved:", response);

    return {
      address: response.paymentRequest,
      paymentRequest: response.paymentRequest,
      fee: response.fee || 0,
    };
  } catch (error: any) {
    console.error("Get Bitcoin address error:", error);
    throw new Error(
      error.message || "Failed to get Bitcoin address. Please try again."
    );
  }
}

export async function sendPayment(bolt11Invoice: string): Promise<any> {
  if (!sdk) {
    throw new Error(
      "Lightning wallet not ready. Please wait for initialization to complete."
    );
  }

  try {
    console.log("🔍 Preparing payment...");

    const prepareResponse = await sdk.prepareSendPayment({
      paymentRequest: bolt11Invoice,
    });

    console.log("✅ Payment prepared:", prepareResponse);

    if (prepareResponse.paymentMethod.type === "bolt11Invoice") {
      console.log(
        "💸 Lightning Fee:",
        prepareResponse.paymentMethod.lightningFeeSats,
        "sats"
      );
      if (prepareResponse.paymentMethod.sparkTransferFeeSats) {
        console.log(
          "💸 Spark Transfer Fee:",
          prepareResponse.paymentMethod.sparkTransferFeeSats,
          "sats"
        );
      }
    }

    console.log("💸 Sending payment...");
    const sendResponse = await sdk.sendPayment({
      prepareResponse,
    });

    console.log("✅ Payment sent successfully:", sendResponse);
    return sendResponse;
  } catch (error: any) {
    console.error("❌ Failed to send payment:", error);

    if (error.message?.includes("insufficient")) {
      throw new Error("Insufficient balance to complete payment");
    } else if (error.message?.includes("route")) {
      throw new Error("Unable to find route to destination");
    } else if (error.message?.includes("timeout")) {
      throw new Error("Payment timed out. Please try again.");
    } else if (error.message?.includes("invoice")) {
      throw new Error("Invalid or expired invoice");
    }

    throw new Error(error.message || "Payment failed. Please try again.");
  }
}

export async function listPayments(): Promise<any[]> {
  if (!sdk) {
    console.warn("⚠️ SDK not initialized, returning empty payments list");
    return [];
  }

  try {
    const response = await sdk.listPayments({
      // Optional filters can be added here
      // limit: 100,
      // offset: 0,
    });

    const paymentsArray = response?.payments || [];

    console.log("📜 Raw payments from SDK:", paymentsArray.length, "payments");

    return paymentsArray.map((p: any) => ({
      id: p.id,
      paymentType: p.paymentType === "send" ? "sent" : "received",
      paymentTime: p.timestamp || Date.now() / 1000,
      amountMsat: Number(p.amount) * 1000 || 0,
      feeMsat: Number(p.fees || 0) * 1000,
      status:
        p.status === "completed"
          ? "complete"
          : p.status === "pending"
          ? "pending"
          : "failed",
      description: p.description || p.details?.description || "",
      bolt11: p.details?.invoice || p.bolt11,
      preimage: p.details?.preimage,
    }));
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
    console.warn("⚠️ SDK not initialized, returning zero balance");
    return { totalSats: 0, spendableSats: 0, receivableSats: 0 };
  }

  try {
    const info = await sdk.getInfo({ ensureSynced: false });
    console.log("💰 Balance:", info);
    return {
      totalSats: info.balanceSats || 0,
      spendableSats: info.balanceSats || 0,
      receivableSats: info.maxReceivableSats || 0,
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
      console.log("Breez SDK disconnected");
    } catch (error) {
      console.error("Failed to disconnect Breez SDK:", error);
    }
  }
}

export function isBreezInitialized(): boolean {
  return sdk !== null;
}
