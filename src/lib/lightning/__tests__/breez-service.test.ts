import type { PrepareSendPaymentResponse } from "@breeztech/breez-sdk-spark";

const { wasmInit, connect, disconnect, sendPayment, getPayment, emit } = vi.hoisted(() => {
  const disconnect = vi.fn(async () => {});
  const sendPayment = vi.fn(async (_request: { options?: unknown; idempotencyKey?: string }) => ({}));
  const getPayment = vi.fn(async (_request: { paymentId: string }) => ({
    payment: { id: "p1", status: "pending" },
  }));
  const listeners: Array<{ onEvent: (event: unknown) => void }> = [];
  return {
    wasmInit: vi.fn(async () => {}),
    disconnect,
    sendPayment,
    getPayment,
    emit: (event: unknown) => listeners.forEach((l) => l.onEvent(event)),
    connect: vi.fn(async () => ({
      addEventListener: vi.fn(async (listener: { onEvent: (event: unknown) => void }) => {
        listeners.push(listener);
        return "listener";
      }),
      disconnect,
      sendPayment,
      getPayment,
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

    for (const p of [onchain, sparkRoute, lightningOnly, spark]) await executeSend(p, "key-1");

    expect(sendPayment.mock.calls.map(([request]) => request.options)).toEqual([
      { type: "bitcoinAddress", confirmationSpeed: ONCHAIN_SPEED },
      { type: "bolt11Invoice", preferSpark: true },
      { type: "bolt11Invoice", preferSpark: false },
      undefined,
    ]);
    expect(sendPayment.mock.calls.every(([request]) => request.idempotencyKey === "key-1")).toBe(true);
  });

  describe("waitForPaymentOutcome", () => {
    it("resolves with the outcome event for that payment", async () => {
      const { initBreez, waitForPaymentOutcome } = await loadService();
      await initBreez(CONFIG);
      const outcome = waitForPaymentOutcome("p1", 5_000);
      emit({ type: "paymentSucceeded", payment: { id: "other", status: "completed" } });
      emit({ type: "paymentFailed", payment: { id: "p1", status: "failed" } });
      await expect(outcome).resolves.toBe("failed");
    });

    it("uses an outcome that landed before it started listening", async () => {
      const { initBreez, waitForPaymentOutcome } = await loadService();
      await initBreez(CONFIG);
      getPayment.mockResolvedValueOnce({ payment: { id: "p1", status: "completed" } });
      await expect(waitForPaymentOutcome("p1", 5_000)).resolves.toBe("completed");
    });

    it("reports a payment still pending after the wait", async () => {
      vi.useFakeTimers();
      const { initBreez, waitForPaymentOutcome } = await loadService();
      await initBreez(CONFIG);
      const outcome = waitForPaymentOutcome("p1", 5_000);
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(outcome).resolves.toBe("pending");
    });
  });
});
