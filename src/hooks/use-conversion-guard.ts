"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Payment } from "@/lib/lightning/types";
import { refundPendingConversions } from "@/lib/lightning/breez-service";
import {
  type ConversionGuard,
  type GuardSnapshot,
  conversionGuard,
} from "@/lib/lightning/conversion-guard";
import { breezKeys } from "@/hooks/use-breez";

function invalidateBreezQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: breezKeys.all });
}

let guardInstance: ConversionGuard = conversionGuard;

/**
 * Watches payments for stuck conversions and automatically requests a refund
 * from the SDK when a payment crosses the strike threshold (3 polls).
 *
 * While a cooldown is active no further refund attempts are made and the
 * UI is expected to disable conversion-triggering buttons.
 *
 * Returns a snapshot whose identity only changes when the guard state moves,
 * keeping re-renders bounded.
 */
export function useConversionGuard(
  payments: Payment[],
  enabled: boolean,
): GuardSnapshot {
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState(() => guardInstance.snapshot());

  const seen = useRef<Payment[] | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (seen.current === payments) return;
    seen.current = payments;

    const next = guardInstance.observe(payments);

    if (
      next.totalStuck > 0 ||
      next.refundInFlight ||
      next.cooldownRemainingMs > 0
    ) {
      setSnapshot(next);
    }

    if (guardInstance.shouldAutoRefund()) {
      guardInstance.beginRefund();
      refundPendingConversions()
        .then(async () => {
          await invalidateBreezQueries(queryClient);
        })
        .catch(() => {})
        .finally(() => {
          guardInstance.noteRefundResolved();
          setSnapshot(guardInstance.snapshot());
        });
    }
  }, [payments, enabled, queryClient]);

  useEffect(() => {
    if (!enabled || snapshot.cooldownRemainingMs <= 0) return;

    const interval = setInterval(() => {
      setSnapshot(guardInstance.snapshot());
    }, 5_000);

    return () => clearInterval(interval);
  }, [enabled, snapshot.cooldownRemainingMs]);

  return snapshot;
}