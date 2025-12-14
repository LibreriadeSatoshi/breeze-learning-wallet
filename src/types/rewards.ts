export interface PendingReward {
  rewardEventId: number;
  contentId: number;
  contentTitle: string;
  contentType: 'course' | 'challenge';
  amountSats: number;
  rewardId: number;
}

export interface RewardsResponse {
  totalSats: number;
  rewards: PendingReward[];
}

export interface ClaimRewardsResponse {
  success: boolean;
  paymentId?: number;
  lightningPaymentHash?: string;
  amountSats: number;
  error?: string;
}

