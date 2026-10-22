import { storageKey } from "@/lib/storage/storage-keys";
import {
  DEFAULT_CLAIM_LEEWAY,
  MAX_CLAIM_LEEWAY,
  getClaimLeeway,
  parseClaimLeeway,
  setClaimLeeway,
} from "../prefs";

describe("claim leeway", () => {
  beforeEach(() => window.localStorage.clear());

  it("accepts whole numbers up to the maximum", () => {
    expect(parseClaimLeeway("0")).toBe(0);
    expect(parseClaimLeeway(" 7 ")).toBe(7);
    expect(parseClaimLeeway(String(MAX_CLAIM_LEEWAY))).toBe(MAX_CLAIM_LEEWAY);
  });

  it("rejects decimals, negatives, empty input and huge values", () => {
    for (const raw of ["1.5", "-5", "", "abc", "1e3", String(MAX_CLAIM_LEEWAY + 1), "100000000000000000000"]) {
      expect(parseClaimLeeway(raw)).toBeNull();
    }
  });

  it("round-trips a saved value", () => {
    setClaimLeeway(5);
    expect(getClaimLeeway()).toBe(5);
  });

  it("refuses to store an invalid value", () => {
    expect(() => setClaimLeeway(1.5)).toThrow(RangeError);
    expect(() => setClaimLeeway(MAX_CLAIM_LEEWAY + 1)).toThrow(RangeError);
  });

  it("falls back to the default for a value stored by an older build", () => {
    window.localStorage.setItem(storageKey("claim-leeway"), "100000000000000000000");
    expect(getClaimLeeway()).toBe(DEFAULT_CLAIM_LEEWAY);
  });
});
