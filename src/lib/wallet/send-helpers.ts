import type { InputType, LnurlPayRequestDetails } from "@breeztech/breez-sdk-spark";
import type {
  PrepareSendResult,
  PrepareLnurlPayResult,
} from "@/lib/lightning/breez-service";

export type PrepareResult =
  | { kind: "send"; data: PrepareSendResult; destinationKind: SendDestinationKind }
  | { kind: "lnurlPay"; data: PrepareLnurlPayResult; domain: string };

type SendDestinationKind =
  | "bolt11"
  | "bolt12"
  | "bitcoinAddress"
  | "sparkAddress"
  | "sparkInvoice"
  | "bip21";

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

export function sendErrorMessage(
  err: unknown,
  t: (k: string) => string,
  fallbackKey: string,
): string {
  const raw = err instanceof Error ? err.message : "";
  if (/self payment/i.test(raw)) return t("send.selfPayment");
  return raw || t(fallbackKey);
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

export function readFeeSat(prep: PrepareResult): number {
  if (prep.kind === "lnurlPay") return prep.data.feeSats;
  const m = prep.data.paymentMethod;
  switch (m.type) {
    case "bolt11Invoice":
      return m.lightningFeeSats + (m.sparkTransferFeeSats ?? 0);
    case "bitcoinAddress":
      return m.feeQuote.speedMedium.userFeeSat + m.feeQuote.speedMedium.l1BroadcastFeeSat;
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
    case "bip21":
      return "bip21";
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
