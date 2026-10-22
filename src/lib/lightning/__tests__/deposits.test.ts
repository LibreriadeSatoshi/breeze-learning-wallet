import { describe, expect, it } from "vitest";
import type { DepositInfo } from "@breeztech/breez-sdk-spark";
import { GENERIC_CLAIM_ERROR_GRACE_MS, isRejectedDeposit } from "../deposits";

const base: DepositInfo = { txid: "ab", vout: 0, amountSats: 1000, isMature: true };
const feeExceeded: DepositInfo["claimError"] = {
  type: "maxDepositClaimFeeExceeded",
  tx: "ab",
  vout: 0,
  requiredFeeSats: 500,
  requiredFeeRateSatPerVbyte: 4,
};
const generic: DepositInfo["claimError"] = { type: "generic", message: "Something went wrong" };
const NOW = 1_000_000;

let nextVout = 1;
function freshDeposit(claimError: DepositInfo["claimError"]): DepositInfo {
  return { ...base, vout: nextVout++, claimError };
}

describe("isRejectedDeposit", () => {
  it("ignores deposits without a claim error", () => {
    expect(isRejectedDeposit(base, NOW)).toBe(false);
  });

  it("flags deposits whose claim fee exceeded the ceiling right away", () => {
    expect(isRejectedDeposit({ ...base, claimError: feeExceeded }, NOW)).toBe(true);
  });

  it("waits out a generic error the SDK may clear on its next retry", () => {
    const deposit = freshDeposit(generic);
    expect(isRejectedDeposit(deposit, NOW)).toBe(false);
    expect(isRejectedDeposit(deposit, NOW + GENERIC_CLAIM_ERROR_GRACE_MS - 1)).toBe(false);
    expect(isRejectedDeposit(deposit, NOW + GENERIC_CLAIM_ERROR_GRACE_MS)).toBe(true);
  });

  it("restarts the wait when a generic error clears and comes back", () => {
    const deposit = freshDeposit(generic);
    isRejectedDeposit(deposit, NOW);
    isRejectedDeposit({ ...deposit, claimError: undefined }, NOW + 1);
    const later = NOW + GENERIC_CLAIM_ERROR_GRACE_MS;
    expect(isRejectedDeposit(deposit, later)).toBe(false);
  });

  it("never offers a refund for an output that is not on chain", () => {
    const deposit = freshDeposit({ type: "missingUtxo", tx: "ab", vout: 0 });
    expect(isRejectedDeposit(deposit, NOW + GENERIC_CLAIM_ERROR_GRACE_MS * 10)).toBe(false);
  });

  it("flags rejected deposits whose instant claim was declined", () => {
    expect(
      isRejectedDeposit(
        { ...base, claimError: feeExceeded, instantClaimStatus: { type: "declined" } },
        NOW,
      ),
    ).toBe(true);
  });

  it("hides deposits whose instant claim is settling or already credited", () => {
    expect(
      isRejectedDeposit(
        { ...base, claimError: feeExceeded, instantClaimStatus: { type: "submitted", claimId: "c1" } },
        NOW,
      ),
    ).toBe(false);
    expect(
      isRejectedDeposit(
        { ...base, claimError: feeExceeded, instantClaimStatus: { type: "claimed" } },
        NOW,
      ),
    ).toBe(false);
  });
});
