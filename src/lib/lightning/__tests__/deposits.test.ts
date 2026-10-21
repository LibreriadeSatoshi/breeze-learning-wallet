import { describe, expect, it } from "vitest";
import type { DepositInfo } from "@breeztech/breez-sdk-spark";
import { isRejectedDeposit } from "../deposits";

const base: DepositInfo = { txid: "ab", vout: 0, amountSats: 1000, isMature: true };
const claimError: DepositInfo["claimError"] = { type: "generic", message: "boom" };

describe("isRejectedDeposit", () => {
  it("ignores deposits without a claim error", () => {
    expect(isRejectedDeposit(base)).toBe(false);
  });

  it("flags deposits whose claim was rejected", () => {
    expect(isRejectedDeposit({ ...base, claimError })).toBe(true);
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
