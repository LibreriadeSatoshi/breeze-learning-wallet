import type { Payment } from "./types";

export const STRIKE_THRESHOLD = 3;

interface BackoffConfig {
  baseMs: number;
  multiplier: number;
  capMs: number;
}

const BACKOFF: BackoffConfig = {
  baseMs: 2 * 60_000,
  multiplier: 2,
  capMs: 30 * 60_000,
};

export const STUCK_CONVERSION_STATUSES = new Set(["failed", "refundNeeded"]);

export const TERMINAL_CONVERSION_STATUSES = new Set([
  "completed",
  "refunded",
  "failed",
  "refundNeeded",
]);

export function isStuckConversion(payment: Payment): boolean {
  const status = payment.conversionDetails?.status;
  return status !== undefined && STUCK_CONVERSION_STATUSES.has(status);
}

export function isTerminalConversion(payment: Payment): boolean {
  const status = payment.conversionDetails?.status;
  return status !== undefined && TERMINAL_CONVERSION_STATUSES.has(status);
}

export function isActiveConversion(payment: Payment): boolean {
  return payment.conversionDetails?.status === "pending";
}

export function computeBackoffMs(
  completedAttempts: number,
  backoff: BackoffConfig = BACKOFF,
): number {
  const exponent = Math.max(0, completedAttempts - 1);
  return Math.min(backoff.baseMs * Math.pow(backoff.multiplier, exponent), backoff.capMs);
}

export interface GuardSnapshot {
  stuckPaymentIds: string[];
  totalStuck: number;
  activeConversionIds: string[];
  totalActive: number;
  refundInFlight: boolean;
  cooldownUntil: number;
  cooldownRemainingMs: number;
  attempts: number;
}

export interface ConversionGuardOptions {
  threshold?: number;
  backoff?: BackoffConfig;
}

export interface ConversionGuard {
  observe(payments: Payment[], now?: number): GuardSnapshot;
  shouldAutoRefund(now?: number): boolean;
  beginRefund(): void;
  noteRefundResolved(now?: number): void;
  snapshot(now?: number): GuardSnapshot;
}

export function createConversionGuard(
  options: ConversionGuardOptions = {},
): ConversionGuard {
  const threshold = options.threshold ?? STRIKE_THRESHOLD;
  const backoff = options.backoff ?? BACKOFF;

  let strikesByPayment = new Map<string, number>();
  let stuckPaymentIds: string[] = [];
  let activeConversionIds: string[] = [];
  let attempts = 0;
  let cooldownUntil = 0;
  let refundInFlight = false;
  let dataAvailable = false;

  function anyStrikeAtThreshold(): boolean {
    for (const strikes of strikesByPayment.values()) {
      if (strikes >= threshold) return true;
    }
    return false;
  }

  function snapshot(now: number = Date.now()): GuardSnapshot {
    const remaining = Math.max(0, cooldownUntil - now);
    return {
      stuckPaymentIds: [...stuckPaymentIds],
      totalStuck: stuckPaymentIds.length,
      activeConversionIds: [...activeConversionIds],
      totalActive: activeConversionIds.length,
      refundInFlight,
      cooldownUntil,
      cooldownRemainingMs: remaining,
      attempts,
    };
  }

  function observe(payments: Payment[], now: number = Date.now()): GuardSnapshot {
    if (payments.length === 0) {
      dataAvailable = false;
      return snapshot(now);
    }
    dataAvailable = true;

    const currentIds = new Set<string>();
    let hasStuck = false;
    let stuck: string[] = [];
    let active: string[] = [];

    for (const payment of payments) {
      if (!payment.conversionDetails) continue;
      currentIds.add(payment.id);

      if (isActiveConversion(payment)) {
        active.push(payment.id);
        continue;
      }

      if (isStuckConversion(payment)) {
        strikesByPayment.set(payment.id, (strikesByPayment.get(payment.id) ?? 0) + 1);
        stuck.push(payment.id);
        hasStuck = true;
      } else if (strikesByPayment.has(payment.id)) {
        strikesByPayment.delete(payment.id);
      }
    }

    for (const id of strikesByPayment.keys()) {
      if (!currentIds.has(id)) strikesByPayment.delete(id);
    }

    stuckPaymentIds = stuck;
    activeConversionIds = active;

    if (!hasStuck) {
      attempts = 0;
      cooldownUntil = 0;
    }

    return snapshot(now);
  }

  function shouldAutoRefund(now: number = Date.now()): boolean {
    if (!dataAvailable) return false;
    if (refundInFlight) return false;
    if (now < cooldownUntil) return false;
    return anyStrikeAtThreshold();
  }

  return {
    observe,
    snapshot,
    shouldAutoRefund,
    beginRefund() {
      refundInFlight = true;
    },
    noteRefundResolved(now: number = Date.now()) {
      refundInFlight = false;

      if (strikesByPayment.size === 0) {
        attempts = 0;
        cooldownUntil = 0;
        return;
      }
      attempts += 1;
      cooldownUntil = now + computeBackoffMs(attempts, backoff);
    },
  };
}

export const conversionGuard = createConversionGuard();