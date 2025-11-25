export interface Payment {
  id: string;
  paymentType: "sent" | "received";
  paymentTime: number;
  amountMsat: number;
  feeMsat: number;
  status: "pending" | "complete" | "failed";
  description?: string;
  bolt11?: string;
  preimage?: string;
}

export interface LightningBalance {
  channelsBalanceMsat: number;
  maxPayableMsat: number;
  maxReceivableMsat: number;
}

export interface NodeInfo {
  id?: string;
  isReady: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
}
