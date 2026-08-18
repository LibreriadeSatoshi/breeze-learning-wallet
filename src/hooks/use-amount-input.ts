"use client";

import { useCallback, useRef, useState } from "react";
import { SATS_PER_BTC } from "@/lib/wallet/format-fiat";

/** A numeric field that shows either sats or USD, backed by a sats value. */
export function useAmountInput(usdRate: number | undefined) {
  const [value, setValue] = useState("");
  const [isSats, setIsSats] = useState(true);
  // Whether the current value came from setFromSats rather than typing.
  const maxed = useRef(false);

  const toSats = (text: string): number | undefined => {
    if (isSats) return Number.parseInt(text.replace(/\D/g, ""), 10) || 0;
    if (!usdRate) return undefined;
    const usd = Number.parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
    return Math.round((usd / usdRate) * SATS_PER_BTC);
  };

  const fromSats = (sats: number, forSats: boolean = isSats): string => {
    if (forSats) return sats.toString();
    if (!usdRate) return "";
    return ((sats / SATS_PER_BTC) * usdRate).toFixed(2);
  };

  const handleChange = (raw: string) => {
    maxed.current = false;
    if (isSats) {
      setValue(raw.replace(/\D/g, ""));
      return;
    }
    if (!usdRate) return;
    const clean = raw.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    setValue(parts.length >= 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : clean);
  };

  const toggleUnit = () => {
    setIsSats((prev) => {
      const next = !prev;
      const sats = toSats(value);
      setValue(sats ? fromSats(sats, next) : "");
      return next;
    });
  };

  return {
    value,
    isSats,
    amountSat: value ? toSats(value) : undefined,
    isMaxed: useCallback(() => maxed.current, []),
    resetMaxed: useCallback(() => {
      maxed.current = false;
    }, []),
    setFromSats: (sats: number) => {
      maxed.current = true;
      setValue(fromSats(sats));
    },
    clear: () => {
      maxed.current = false;
      setValue("");
    },
    handleChange,
    toggleUnit,
  };
}
