import { describe, it, expect } from "vitest";
import { computeBackoffMs, createConversionGuard, isActiveConversion, isStuckConversion, isTerminalConversion } from "@/lib/lightning/conversion-guard";

function payment(id: string, conversionStatus?: string) {
  return {
    id,
    paymentType: "sent" as const,
    paymentTime: Date.now(),
    amount: 1000,
    fees: 0,
    status: conversionStatus === "completed" || conversionStatus === "refunded"
      ? ("complete" as const)
      : (conversionStatus === "failed" ? ("failed" as const) : ("pending" as const)),
    method: "lightning" as const,
    conversionDetails: conversionStatus
      ? { status: conversionStatus, from: { amount: 1, fee: 0, ticker: "BTC", decimals: 11 }, to: { amount: 1000, fee: 0, ticker: "USDB", decimals: 6 } }
      : undefined,
  };
}

describe("computeBackoffMs", () => {
  it("grows exponentially and caps at 30 minutes", () => {
    // First completed attempt: base (2 min)
    expect(computeBackoffMs(1)).toBe(120_000);
    expect(computeBackoffMs(2)).toBe(240_000);
    expect(computeBackoffMs(3)).toBe(480_000);
    expect(computeBackoffMs(4)).toBe(960_000);
    // Cap: 2^7 min would be 256 min, so it must stop at 30 min.
    expect(computeBackoffMs(8)).toBe(1_800_000);
    expect(computeBackoffMs(10)).toBe(1_800_000);
  });
});

describe("isStuckConversion", () => {
  it("only treats failed/refundNeeded as stuck", () => {
    expect(isStuckConversion(payment("a", "failed"))).toBe(true);
    expect(isStuckConversion(payment("a", "refundNeeded"))).toBe(true);
    expect(isStuckConversion(payment("a", "pending"))).toBe(false);
    expect(isStuckConversion(payment("a", "completed"))).toBe(false);
    expect(isStuckConversion(payment("a", "refunded"))).toBe(false);
    expect(isStuckConversion(payment("a"))).toBe(false);
  });
});

describe("isActiveConversion", () => {
  it("only treats pending as active", () => {
    expect(isActiveConversion(payment("a", "pending"))).toBe(true);
    expect(isActiveConversion(payment("a", "failed"))).toBe(false);
    expect(isActiveConversion(payment("a", "refundNeeded"))).toBe(false);
    expect(isActiveConversion(payment("a", "completed"))).toBe(false);
    expect(isActiveConversion(payment("a", "refunded"))).toBe(false);
    expect(isActiveConversion(payment("a"))).toBe(false);
  });
});

describe("isTerminalConversion", () => {
  it("treats every known outcome as terminal, never pending", () => {
    expect(isTerminalConversion(payment("a", "completed"))).toBe(true);
    expect(isTerminalConversion(payment("a", "refunded"))).toBe(true);
    expect(isTerminalConversion(payment("a", "failed"))).toBe(true);
    expect(isTerminalConversion(payment("a", "refundNeeded"))).toBe(true);
    expect(isTerminalConversion(payment("a", "pending"))).toBe(false);
    expect(isTerminalConversion(payment("a"))).toBe(false);
  });
});

describe("createConversionGuard", () => {
  it("counts consecutive stuck polls per payment and resets on recovery", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    guard.observe([payment("a", "failed")], now);
    expect(guard.snapshot(now).totalStuck).toBe(1);
    expect(guard.snapshot(now).cooldownRemainingMs).toBe(0);

    guard.observe([payment("a", "failed")], now + 60_000);
    guard.observe([payment("a", "failed")], now + 120_000);
    expect(guard.shouldAutoRefund(now + 120_000)).toBe(true);

    // Recovered: even a previously-stuck payment resets.
    guard.observe([payment("a", "refunded")], now + 180_000);
    expect(guard.snapshot(now + 180_000).totalStuck).toBe(0);
    expect(guard.shouldAutoRefund(now + 180_000)).toBe(false);
  });

  it("reports active (pending) conversions without counting them as stuck", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    guard.observe(
      [payment("a", "pending"), payment("b", "pending"), payment("c", "failed")],
      now,
    );
    const snap = guard.snapshot(now);
    expect(snap.totalActive).toBe(2);
    expect(snap.activeConversionIds).toEqual(["a", "b"]);
    expect(snap.totalStuck).toBe(1);
    expect(snap.stuckPaymentIds).toEqual(["c"]);

    // Repeated pending polls never build strikes: no refund should ever fire
    // for a conversion that is merely slow but still in flight.
    guard.observe([payment("a", "pending")], now + 60_000);
    guard.observe([payment("a", "pending")], now + 120_000);
    guard.observe([payment("a", "pending")], now + 180_000);
    expect(guard.shouldAutoRefund(now + 180_000)).toBe(false);
  });

  it("drops stale payments from strike tracking", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    guard.observe([payment("a", "failed")], now);
    guard.observe([payment("b", "failed")], now + 60_000);
    // "a" is no longer present in the poll, so it must be purged.
    expect(guard.snapshot(now + 60_000).stuckPaymentIds).toEqual(["b"]);
  });

  it("does not trigger refund before the threshold", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    guard.observe([payment("a", "refundNeeded")], now);
    guard.observe([payment("a", "refundNeeded")], now + 60_000);
    expect(guard.shouldAutoRefund(now + 60_000)).toBe(false);
  });

  it("only fires once: no retry during cooldown, backoff grows after each attempt", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      guard.observe([payment("a", "failed")], now + i * 60_000);
    }
    expect(guard.shouldAutoRefund(now + 120_000)).toBe(true);

    guard.beginRefund();
    guard.noteRefundResolved(now + 120_000);
    // Attempt 1 done => 2 min cooldown.
    expect(guard.snapshot(now + 120_000).cooldownRemainingMs).toBe(120_000);
    expect(guard.shouldAutoRefund(now + 180_000)).toBe(false);

    // After cooldown + still stuck, a second attempt is allowed and backs off more.
    guard.observe([payment("a", "failed")], now + 360_000);
    guard.beginRefund();
    guard.noteRefundResolved(now + 360_000);
    expect(guard.snapshot(now + 360_000).cooldownRemainingMs).toBe(240_000);
  });

  it("does not try to refund while a refund is in flight", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      guard.observe([payment("a", "failed")], now + i * 60_000);
    }
    expect(guard.shouldAutoRefund(now + 120_000)).toBe(true);

    guard.beginRefund();
    expect(guard.shouldAutoRefund(now + 120_000)).toBe(false);
  });

  it("early recovery resets cooldown and attempt count", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      guard.observe([payment("a", "failed")], now + i * 60_000);
    }
    guard.beginRefund();
    guard.noteRefundResolved(now + 120_000);
    expect(guard.snapshot(now + 120_000).cooldownRemainingMs).toBe(120_000);

    // Next poll shows the payment is now refunded/completed: cooldown cleared.
    guard.observe([payment("a", "refunded")], now + 180_000);
    expect(guard.snapshot(now + 180_000).cooldownRemainingMs).toBe(0);
    expect(guard.snapshot(now + 180_000).attempts).toBe(0);
  });

  it("recovers from a degraded (empty) poll without resetting anything", () => {
    const guard = createConversionGuard({ threshold: 3 });
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      guard.observe([payment("a", "failed")], now + i * 60_000);
    }
    const snapshotThen = guard.snapshot(now + 120_000);
    expect(snapshotThen.cooldownRemainingMs).toBe(0);
    expect(guard.shouldAutoRefund(now + 120_000)).toBe(true);

    // Empty result (e.g. offline poll) must NOT reset the strike map AND must
    // not trigger a refund on a degraded snapshot.
    guard.observe([], now + 180_000);
    expect(guard.shouldAutoRefund(now + 180_000)).toBe(false);

    // A fresh, non-empty stuck poll resumes where it left off: still over
    // threshold, so it refunds again.
    guard.observe([payment("a", "failed")], now + 240_000);
    expect(guard.shouldAutoRefund(now + 240_000)).toBe(true);
  });
});