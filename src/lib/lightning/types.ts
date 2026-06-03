// Internal payment shape exposed to the React layer. We keep amounts as
// plain `number` (sats) because the SDK ships `bigint` and React renders
// don't need that precision.
export interface Payment {
  id: string;
  paymentType: "sent" | "received";
  paymentTime: number;
  amountSat: number;
  feeSat: number;
  status: "pending" | "complete" | "failed";
  description?: string;
  bolt11?: string;
  preimage?: string;
  method: "lightning" | "spark" | "token" | "deposit" | "withdraw" | "unknown";
}

export interface WalletBalance {
  totalSat: number;
  identityPubkey: string;
}

export interface NodeInfo {
  id?: string;
  isReady: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
}
