import type { DepositInfo } from "@breeztech/breez-sdk-spark";

// The SDK retries every unclaimed deposit on each sync, so a generic or
// missing-UTXO error is transient. Only a fee above the user's ceiling needs
// them to act. An instantly claimed deposit stays listed until the provider
// spends its output, but the funds are already credited.
export function isRejectedDeposit(deposit: DepositInfo): boolean {
  if (deposit.claimError?.type !== "maxDepositClaimFeeExceeded") return false;
  const instant = deposit.instantClaimStatus?.type;
  return instant !== "submitted" && instant !== "claimed";
}
