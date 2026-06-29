import type { Seed, PasskeyClient } from "@breeztech/breez-sdk-spark";
import { APP_NAME } from "@/lib/config";

const RP_NAME = APP_NAME;
const DEFAULT_LABEL = "Default";

function getRpId(): string {
  return window.location.hostname;
}

async function getClient(): Promise<PasskeyClient> {
  const sdk = await import("@breeztech/breez-sdk-spark/web");
  if (sdk.default && typeof sdk.default === "function") {
    await sdk.default();
  }
  const { PasskeyProvider } = await import(
    "@breeztech/breez-sdk-spark/passkey-prf-provider"
  );
  const provider = new PasskeyProvider(
    { rpId: getRpId(), rpName: RP_NAME },
    {
      authenticatorAttachment: "platform",
      hints: ["client-device"],
      defaultTimeoutMs: 55_000,
    },
  );
  return new sdk.PasskeyClient(provider);
}

export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const client = await getClient();
    const availability = await client.checkAvailability();
    return availability.type === "available";
  } catch {
    return false;
  }
}

export async function registerPasskey(): Promise<Seed> {
  const client = await getClient();
  const response = await client.register({ label: DEFAULT_LABEL });
  return response.wallet.seed;
}

export async function signInWithPasskey(): Promise<Seed> {
  const client = await getClient();
  const response = await client.signIn({ label: DEFAULT_LABEL });
  return response.wallet.seed;
}

export function seedToMnemonic(seed: Seed): string {
  if (seed.type === "mnemonic") return seed.mnemonic;
  throw new Error("Passkey returned a non-mnemonic seed; not expected");
}
