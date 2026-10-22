import type {
  BitcoinNetwork,
  InputType,
  LnurlPayRequestDetails,
  OnchainConfirmationSpeed,
} from "@breeztech/breez-sdk-spark";
import { SELECTED_BITCOIN_NETWORK } from "@/lib/config";
import {
  ONCHAIN_SPEED,
  type PrepareSendResult,
  type PrepareLnurlPayResult,
} from "@/lib/lightning/breez-service";

export type PrepareResult =
  | { kind: "send"; data: PrepareSendResult; destinationKind: SendDestinationKind; memo?: string }
  | { kind: "lnurlPay"; data: PrepareLnurlPayResult; domain: string };

type SendDestinationKind =
  | "bolt11"
  | "bolt12"
  | "bitcoinAddress"
  | "sparkAddress"
  | "sparkInvoice";

type Bip21 = Extract<InputType, { type: "bip21" }>;

// Lightning first, then Spark, then on-chain: cheapest and fastest first.
const BIP21_PREFERENCE = [
  "bolt11Invoice",
  "bolt12Offer",
  "sparkInvoice",
  "sparkAddress",
  "bitcoinAddress",
] as const;

function paymentString(method: InputType): string | null {
  switch (method.type) {
    case "bolt11Invoice":
      return method.invoice.bolt11;
    case "bolt12Offer":
      return method.offer.offer;
    case "sparkInvoice":
      return method.invoice;
    case "sparkAddress":
    case "bitcoinAddress":
      return method.address;
    default:
      return null;
  }
}

// The SDK parses a BIP21 URI but can't prepare a payment to it directly.
export function pickBip21Method(bip21: Bip21): { input: string; parsed: InputType } | null {
  for (const type of BIP21_PREFERENCE) {
    const method = bip21.paymentMethods.find((m) => m.type === type);
    const input = method && paymentString(method);
    if (method && input) return { input, parsed: method };
  }
  return null;
}

export const WALLET_NETWORK: BitcoinNetwork =
  SELECTED_BITCOIN_NETWORK === "mainnet" ? "bitcoin" : "regtest";

export function isOtherNetwork(parsed: InputType): boolean {
  switch (parsed.type) {
    case "bitcoinAddress":
    case "bolt11Invoice":
    case "sparkAddress":
    case "sparkInvoice":
      return parsed.network !== WALLET_NETWORK;
    default:
      return false;
  }
}

export function describeRecipient(prep: PrepareResult): { to: string; memo?: string } {
  if (prep.kind === "lnurlPay") {
    return { to: prep.data.payRequest.address ?? prep.domain, memo: prep.data.comment };
  }
  const m = prep.data.paymentMethod;
  switch (m.type) {
    case "bolt11Invoice":
      return { to: m.invoiceDetails.invoice.bolt11, memo: m.invoiceDetails.description ?? prep.memo };
    case "bitcoinAddress":
      return { to: m.address.address, memo: prep.memo };
    case "sparkAddress":
      return { to: m.address, memo: prep.memo };
    case "sparkInvoice":
      return { to: m.sparkInvoiceDetails.invoice, memo: m.sparkInvoiceDetails.description ?? prep.memo };
    case "crossChainAddress":
      return { to: m.recipientAddress, memo: prep.memo };
  }
}

export function pickLnurlPayDetails(
  parsed: Extract<InputType, { type: "lnurlPay" }>,
): LnurlPayRequestDetails {
  return {
    callback: parsed.callback,
    minSendable: parsed.minSendable,
    maxSendable: parsed.maxSendable,
    metadataStr: parsed.metadataStr,
    commentAllowed: parsed.commentAllowed,
    domain: parsed.domain,
    url: parsed.url,
    address: parsed.address,
    allowsNostr: parsed.allowsNostr,
    nostrPubkey: parsed.nostrPubkey,
  };
}

export function readAmountSat(prep: PrepareResult): number | null {
  if (prep.kind === "lnurlPay") return prep.data.amountSats;
  return Number(prep.data.amount);
}

// SDK errors are developer text, so they map to copy and are never shown raw.
const SEND_ERRORS: ReadonlyArray<[RegExp, string]> = [
  [/self payment/i, "send.selfPayment"],
  [/invalid network|network does not match|wrong network/i, "send.errors.wrongNetwork"],
  [/network error|failed to fetch/i, "send.errors.offline"],
  [/insufficient/i, "send.errors.insufficientFunds"],
  [/amount is required/i, "send.errors.amountRequired"],
  [/expired/i, "send.errors.expired"],
  [/amount too (small|large)|dust/i, "send.errors.amountOutOfRange"],
  [/route/i, "send.errors.noRoute"],
  [/timed? ?out/i, "send.errors.timeout"],
  [/lnurl/i, "send.errors.lnurl"],
  [/invalid input|invalid spark address|unsupported payment method|unrecogni[sz]ed/i, "send.parseFailed"],
];

export function sendErrorMessage(
  err: unknown,
  t: (k: string) => string,
  fallbackKey: string,
): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const match = SEND_ERRORS.find(([pattern]) => pattern.test(raw));
  if (!match) console.warn("Unmapped send error:", raw);
  return t(match ? match[1] : fallbackKey);
}

export function overspends(prep: PrepareResult, balanceSat: number): boolean {
  if (prep.kind === "send") {
    const { tokenIdentifier, paymentMethod } = prep.data;
    if (tokenIdentifier || paymentMethod.type === "crossChainAddress") return false;
  }
  const amountSat = readAmountSat(prep);
  if (amountSat === null) return false;
  const spend =
    prep.data.feePolicy === "feesIncluded" ? amountSat : amountSat + readFeeSat(prep);
  return spend > balanceSat;
}

const SPEED_QUOTE: Record<OnchainConfirmationSpeed, "speedFast" | "speedMedium" | "speedSlow"> = {
  fast: "speedFast",
  medium: "speedMedium",
  slow: "speedSlow",
};

export function readFeeSat(prep: PrepareResult): number {
  if (prep.kind === "lnurlPay") return prep.data.feeSats;
  const m = prep.data.paymentMethod;
  switch (m.type) {
    case "bolt11Invoice":
      // Alternatives, not a sum: the send goes over Spark whenever it's offered.
      return m.sparkTransferFeeSats ?? m.lightningFeeSats;
    case "bitcoinAddress": {
      const quote = m.feeQuote[SPEED_QUOTE[ONCHAIN_SPEED]];
      return quote.userFeeSat + quote.l1BroadcastFeeSat;
    }
    case "sparkAddress":
    case "sparkInvoice":
      return m.tokenIdentifier ? 0 : Number(m.fee);
    case "crossChainAddress":
      // feeAmount is in the destination asset's base units, not sats.
      return m.sourceTransferFeeSats;
  }
}

export function destinationKindForParsed(parsed: InputType): SendDestinationKind {
  switch (parsed.type) {
    case "bolt11Invoice":
      return "bolt11";
    case "bolt12Offer":
    case "bolt12Invoice":
    case "bolt12InvoiceRequest":
      return "bolt12";
    case "bitcoinAddress":
      return "bitcoinAddress";
    case "sparkAddress":
      return "sparkAddress";
    case "sparkInvoice":
      return "sparkInvoice";
    default:
      return "bolt11";
  }
}

export function describeDestination(
  prep: PrepareResult,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  if (prep.kind === "lnurlPay") return t("send.destinationKind.lnurlPay", { domain: prep.domain });
  return t(`send.destinationKind.${prep.destinationKind}`);
}

export function describeUnsupported(
  parsed: InputType,
  t: (k: string) => string,
): string | null {
  switch (parsed.type) {
    case "lnurlAuth":
      return t("send.unsupported.lnurlAuth");
    case "lnurlWithdraw":
      return t("send.unsupported.lnurlWithdraw");
    case "url":
      return t("send.unsupported.url");
    case "silentPaymentAddress":
      return t("send.unsupported.silentPayment");
    default:
      return null;
  }
}
