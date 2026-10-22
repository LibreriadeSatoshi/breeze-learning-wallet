import type { InputType, PrepareSendPaymentResponse } from "@breeztech/breez-sdk-spark";
import {
  type PrepareResult,
  WALLET_NETWORK,
  describeRecipient,
  isOtherNetwork,
  pickBip21Method,
  readFeeSat,
  sendErrorMessage,
} from "../send-helpers";

type Bip21 = Extract<InputType, { type: "bip21" }>;

const onchain = { type: "bitcoinAddress", address: "bcrt1qaddr", network: WALLET_NETWORK } as InputType;
const spark = { type: "sparkAddress", address: "sparkrt1addr", network: WALLET_NETWORK } as InputType;
const bolt11 = {
  type: "bolt11Invoice",
  invoice: { bolt11: "lnbcrt1invoice" },
  network: WALLET_NETWORK,
} as InputType;

function bip21(paymentMethods: InputType[]): Bip21 {
  return { type: "bip21", uri: "bitcoin:x", extras: [], paymentMethods, amountSat: 1500 } as Bip21;
}

function sendPrep(paymentMethod: object, memo?: string): PrepareResult {
  return {
    kind: "send",
    data: { paymentMethod, amount: BigInt(1000), feePolicy: "feesExcluded" } as PrepareSendPaymentResponse,
    destinationKind: "bolt11",
    memo,
  };
}

describe("pickBip21Method", () => {
  it("prefers Lightning, then Spark, then on-chain", () => {
    expect(pickBip21Method(bip21([onchain, spark, bolt11]))).toEqual({ input: "lnbcrt1invoice", parsed: bolt11 });
    expect(pickBip21Method(bip21([onchain, spark]))).toEqual({ input: "sparkrt1addr", parsed: spark });
    expect(pickBip21Method(bip21([onchain]))).toEqual({ input: "bcrt1qaddr", parsed: onchain });
  });

  it("returns nothing when no method is payable", () => {
    expect(pickBip21Method(bip21([{ type: "url" } as InputType]))).toBeNull();
  });
});

describe("isOtherNetwork", () => {
  it("flags destinations for another network", () => {
    expect(isOtherNetwork(onchain)).toBe(false);
    const other = WALLET_NETWORK === "bitcoin" ? "regtest" : "bitcoin";
    expect(isOtherNetwork({ ...(onchain as object), network: other } as InputType)).toBe(true);
    expect(isOtherNetwork({ type: "lightningAddress" } as InputType)).toBe(false);
  });
});

describe("describeRecipient", () => {
  it("shows the Lightning address for LNURL payments", () => {
    const prep = {
      kind: "lnurlPay",
      domain: "pay.example.com",
      data: { payRequest: { address: "alice@pay.example.com" } },
    } as PrepareResult;
    expect(describeRecipient(prep)).toEqual({ to: "alice@pay.example.com", memo: undefined });
  });

  it("uses the invoice description, else the payment link's note", () => {
    const invoice = {
      type: "bolt11Invoice",
      invoiceDetails: { invoice: { bolt11: "lnbcrt1x" }, description: "Coffee" },
      lightningFeeSats: 0,
    };
    expect(describeRecipient(sendPrep(invoice, "From link"))).toEqual({ to: "lnbcrt1x", memo: "Coffee" });
    expect(
      describeRecipient(sendPrep({ type: "bitcoinAddress", address: { address: "bcrt1q" } }, "Rent")),
    ).toEqual({ to: "bcrt1q", memo: "Rent" });
  });
});

describe("readFeeSat", () => {
  it("charges the Spark fee when the invoice can be paid over Spark", () => {
    expect(readFeeSat(sendPrep({ type: "bolt11Invoice", lightningFeeSats: 7, sparkTransferFeeSats: 0 }))).toBe(0);
    expect(readFeeSat(sendPrep({ type: "bolt11Invoice", lightningFeeSats: 7 }))).toBe(7);
  });
});

describe("sendErrorMessage", () => {
  const t = (key: string) => key;

  it("maps SDK errors to copy instead of showing them raw", () => {
    const cases: Array<[string, string]> = [
      ["SparkSdkError: Invalid network", "send.errors.wrongNetwork"],
      ["Lnurl error: lnurl has invalid invoice: Invoice network does not match config", "send.errors.wrongNetwork"],
      ["Network error: failed to fetch", "send.errors.offline"],
      ["Insufficient funds", "send.errors.insufficientFunds"],
      ["Invalid input: Amount is required", "send.errors.amountRequired"],
      ["Invalid input: Invoice has expired", "send.errors.expired"],
      ["Amount too small", "send.errors.amountOutOfRange"],
      ["Invalid input: Invalid spark address", "send.parseFailed"],
      ["Unable to find route", "send.errors.noRoute"],
      ["Request timed out", "send.errors.timeout"],
      ["Lnurl error: service unavailable", "send.errors.lnurl"],
      ["Invalid input: Unsupported payment method", "send.parseFailed"],
      ["cannot pay: self payment", "send.selfPayment"],
    ];
    for (const [raw, key] of cases) {
      expect(sendErrorMessage(new Error(raw), t, "send.failed")).toBe(key);
    }
  });

  it("falls back to the given copy for anything unrecognised", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(sendErrorMessage(new Error("boom"), t, "send.failed")).toBe("send.failed");
  });
});
