// Amounts as `number` (sats); SDK ships `bigint` we don't need in UI.
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
