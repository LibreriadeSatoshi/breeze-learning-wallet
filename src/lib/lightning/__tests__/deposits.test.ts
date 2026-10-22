import { describe, expect, it } from "vitest";
import type { DepositInfo } from "@breeztech/breez-sdk-spark";
import { isRejectedDeposit } from "../deposits";

const base: DepositInfo = { txid: "ab", vout: 0, amountSats: 1000, isMature: true };
const claimError: DepositInfo["claimError"] = {
  type: "maxDepositClaimFeeExceeded",
  tx: "ab",
  vout: 0,
  requiredFeeSats: 500,
  requiredFeeRateSatPerVbyte: 4,
};

describe("isRejectedDeposit", () => {
  it("ignores deposits without a claim error", () => {
    expect(isRejectedDeposit(base)).toBe(false);
  });

  it("flags deposits whose claim fee exceeded the ceiling", () => {
    expect(isRejectedDeposit({ ...base, claimError })).toBe(true);
  });

  it("ignores transient claim errors the SDK retries on the next sync", () => {
    expect(
      isRejectedDeposit({ ...base, claimError: { type: "generic", message: "Something went wrong" } }),
    ).toBe(false);
    expect(
      isRejectedDeposit({ ...base, claimError: { type: "missingUtxo", tx: "ab", vout: 0 } }),
    ).toBe(false);
  });

  it("flags rejected deposits whose instant claim was declined", () => {
    expect(
      isRejectedDeposit({ ...base, claimError, instantClaimStatus: { type: "declined" } }),
    ).toBe(true);
  });

  it("hides deposits whose instant claim is settling", () => {
    expect(
      isRejectedDeposit({
        ...base,
        claimError,
        instantClaimStatus: { type: "submitted", claimId: "c1" },
      }),
    ).toBe(false);
  });

  it("hides deposits whose instant claim already credited the wallet", () => {
    expect(
      isRejectedDeposit({ ...base, claimError, instantClaimStatus: { type: "claimed" } }),
    ).toBe(false);
  });
});
