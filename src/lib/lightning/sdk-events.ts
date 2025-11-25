export interface Payment {
  id: string;
  amountMsat?: number;
  status?: string;
  timestamp?: number;
}

export interface DepositInfo {
  txId: string;
  amount: number;
}

export type SdkEvent =
  | { type: 'synced' }
  | { type: 'dataSynced'; didPullNewRecords: boolean }
  | { type: 'unclaimedDeposits'; unclaimedDeposits: DepositInfo[] }
  | { type: 'claimedDeposits'; claimedDeposits: DepositInfo[] }
  | { type: 'paymentSucceeded'; payment: Payment }
  | { type: 'paymentPending'; payment: Payment }
  | { type: 'paymentFailed'; payment: Payment };

