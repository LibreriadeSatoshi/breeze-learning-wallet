import type { DepositInfo } from "@breeztech/breez-sdk-spark";

// An instantly claimed deposit stays listed until the provider spends its
// output, but the funds are already credited and must not be offered for refund.
export function isRejectedDeposit(deposit: DepositInfo): boolean {
  if (!deposit.claimError) return false;
  const instant = deposit.instantClaimStatus?.type;
  return instant !== "submitted" && instant !== "claimed";
}
