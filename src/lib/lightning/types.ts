import type { FetchConversionLimitsResponse, TokenMetadata } from "@breeztech/breez-sdk-spark/web";

export type PaymentType = "sent" | "received";
export type PaymentStatus = "pending" | "complete" | "failed";
export type PaymentMethod = "lightning" | "spark" | "token" | "deposit" | "withdraw" | "unknown";
export type ContactAction = "add" | "update" | "remove"

export type Balances = {
  totalSats: number;
  tokenUSDB?: { balance: number; tokenMetadata: TokenMetadata };
};

// Amounts as `number` (sats); SDK ships `bigint` we don't need in UI.

export interface Payment {
  id: string;
  paymentType: PaymentType;
  paymentTime: number;
  amount: number;
  fees: number;
  status: PaymentStatus;
  description?: string;
  bolt11?: string;
  preimage?: string;
  method: PaymentMethod;
  purpose?: string;
  conversionDetails?: {
    status: string;
    from: {
      amount: number;
      fee: number;
      ticker: string;
      decimals: number;
    };
    to: {
      amount: number;
      fee: number;
      ticker: string;
      decimals: number;
    };
  };
}

export interface ConversionLimits {
  fromBitcoin?: FetchConversionLimitsResponse;
  toBitcoin?: FetchConversionLimitsResponse;
}

export type { UserSettings } from "@breeztech/breez-sdk-spark/web";

export interface ReceivedPaymentDetails {
  id: string;
  amountSat: number;
  feesSat: number;
  timestamp: number;
  method: "lightning" | "spark" | "deposit" | "token";
  status: string;
}
