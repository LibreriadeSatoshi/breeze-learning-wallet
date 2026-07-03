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
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    console.warn("[passkey] PublicKeyCredential unavailable (insecure context?)");
    return false;
  }
  try {
    const client = await getClient();
    const availability = await client.checkAvailability();
    // "skipped" means the provider couldn't verify domain association, not
    // that passkeys are unusable — the browser enforces rpId scope at
    // ceremony time, and our rpId always equals the current hostname.
    if (availability.type === "available" || availability.type === "skipped") {
      return true;
    }
    console.warn("[passkey] not available:", availability);
    return false;
  } catch (e) {
    console.warn("[passkey] availability check threw:", e);
    return false;
  }
}

// Android's credential manager sporadically fails the first ceremony after a
// page load with a transient "unknown error"; a retry succeeds.
async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const transient =
        e instanceof Error && /unknown error.*credential manager/i.test(e.message);
      if (!transient || attempt >= MAX_ATTEMPTS) throw e;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function registerPasskey(): Promise<Seed> {
  const client = await getClient();
  const response = await withTransientRetry(() => client.register({ label: DEFAULT_LABEL }));
  return response.wallet.seed;
}

export async function signInWithPasskey(): Promise<Seed> {
  const client = await getClient();
  const response = await withTransientRetry(() => client.signIn({ label: DEFAULT_LABEL }));
  return response.wallet.seed;
}

export function seedToMnemonic(seed: Seed): string {
  if (seed.type === "mnemonic") return seed.mnemonic;
  throw new Error("Passkey returned a non-mnemonic seed; not expected");
}
