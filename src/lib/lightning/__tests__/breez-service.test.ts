import type { PrepareSendPaymentResponse } from "@breeztech/breez-sdk-spark";

const { wasmInit, connect, disconnect, sendPayment } = vi.hoisted(() => {
  const disconnect = vi.fn(async () => {});
  const sendPayment = vi.fn(async (_request: { options?: unknown }) => ({}));
  return {
    wasmInit: vi.fn(async () => {}),
    disconnect,
    sendPayment,
    connect: vi.fn(async () => ({
      addEventListener: vi.fn(async () => "listener"),
      disconnect,
      sendPayment,
    })),
  };
});

vi.unmock("@/lib/lightning/breez-service");

vi.mock("@breeztech/breez-sdk-spark/web", () => ({
  default: wasmInit,
  connect,
  defaultConfig: () => ({}),
}));

const CONFIG = { network: "regtest" as const, mnemonic: "seed words" };

async function loadService() {
  return import("../breez-service");
}

describe("breez service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ apiKey: "key" })));
  });

  it("initializes the WASM module once for concurrent callers", async () => {
    const { initBreez, loadBreezModule } = await loadService();
    await Promise.all([initBreez(CONFIG), loadBreezModule(), loadBreezModule()]);
    expect(wasmInit).toHaveBeenCalledTimes(1);
  });

  it("connects once when init is called concurrently", async () => {
    const { initBreez } = await loadService();
    await Promise.all([initBreez(CONFIG), initBreez(CONFIG)]);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("reconnects after a disconnect queued behind an init", async () => {
    const { initBreez, disconnectBreez } = await loadService();
    const first = initBreez(CONFIG);
    const stop = disconnectBreez();
    const second = initBreez(CONFIG);
    await Promise.all([first, stop, second]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("sends with the options whose fee was quoted", async () => {
    const { initBreez, executeSend, ONCHAIN_SPEED } = await loadService();
    await initBreez(CONFIG);
    const prep = (paymentMethod: object) => ({ paymentMethod }) as PrepareSendPaymentResponse;
    const onchain = prep({ type: "bitcoinAddress" });
    const sparkRoute = prep({ type: "bolt11Invoice", lightningFeeSats: 5, sparkTransferFeeSats: 0 });
    const lightningOnly = prep({ type: "bolt11Invoice", lightningFeeSats: 5 });
    const spark = prep({ type: "sparkAddress" });

    for (const p of [onchain, sparkRoute, lightningOnly, spark]) await executeSend(p);

    expect(sendPayment.mock.calls.map(([request]) => request.options)).toEqual([
      { type: "bitcoinAddress", confirmationSpeed: ONCHAIN_SPEED },
      { type: "bolt11Invoice", preferSpark: true },
      { type: "bolt11Invoice", preferSpark: false },
      undefined,
    ]);
  });
});
