"use client";

import { useState } from "react";
import { SATS_PER_BTC } from "@/lib/wallet/format-fiat";

/** A numeric field that shows either sats or USD, backed by a sats value. */
export function useAmountInput(usdRate: number | undefined) {
  const [value, setValue] = useState("");
  const [isSats, setIsSats] = useState(true);
  const [sats, setSats] = useState<number>();

  const toSats = (text: string): number | undefined => {
    if (isSats) return Number.parseInt(text.replace(/\D/g, ""), 10) || 0;
    if (!usdRate) return undefined;
    const usd = Number.parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
    return Math.round((usd / usdRate) * SATS_PER_BTC);
  };

  const fromSats = (amountSat: number, forSats: boolean = isSats): string => {
    if (forSats) return amountSat.toString();
    if (!usdRate) return "";
    return ((amountSat / SATS_PER_BTC) * usdRate).toFixed(2);
  };

  const handleChange = (raw: string) => {
    if (isSats) {
      const clean = raw.replace(/\D/g, "");
      setValue(clean);
      setSats(clean ? toSats(clean) : undefined);
      return;
    }
    if (!usdRate) return;
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const clean = parts.length >= 2 ? `${parts[0]}.${parts[1].slice(0, 2)}` : cleaned;
    setValue(clean);
    setSats(clean ? toSats(clean) : undefined);
  };

  const toggleUnit = () => {
    setIsSats((prev) => {
      const next = !prev;
      if (sats) {
        setValue(fromSats(sats, next));
      } else {
        setValue("");
        setSats(undefined);
      }
      return next;
    });
  };

  return {
    value,
    isSats,
    amountSat: sats,
    setFromSats: (amountSat: number) => {
      setSats(amountSat);
      setValue(fromSats(amountSat));
    },
    clear: () => {
      setSats(undefined);
      setValue("");
    },
    handleChange,
    toggleUnit,
  };
}
