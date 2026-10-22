import type { DepositInfo } from "@breeztech/breez-sdk-spark";

// The SDK retries every unclaimed deposit on each sync, and a retry often clears
// a generic error. It also reports permanent failures (such as a deposit too
// small to quote) as generic, so one that outlasts this window needs a refund.
export const GENERIC_CLAIM_ERROR_GRACE_MS = 10 * 60_000;

const genericErrorFirstSeen = new Map<string, number>();

// An instantly claimed deposit stays listed until the provider spends its
// output, but the funds are already credited and must not be offered for refund.
export function isRejectedDeposit(deposit: DepositInfo, now: number): boolean {
  const instant = deposit.instantClaimStatus?.type;
  if (instant === "submitted" || instant === "claimed") return false;

  const key = `${deposit.txid}:${deposit.vout}`;
  switch (deposit.claimError?.type) {
    case "maxDepositClaimFeeExceeded":
      return true;
    case "generic": {
      const firstSeen = genericErrorFirstSeen.get(key) ?? now;
      genericErrorFirstSeen.set(key, firstSeen);
      return now - firstSeen >= GENERIC_CLAIM_ERROR_GRACE_MS;
    }
    default:
      genericErrorFirstSeen.delete(key);
      return false;
  }
}
