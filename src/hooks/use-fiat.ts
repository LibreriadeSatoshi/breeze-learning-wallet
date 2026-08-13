import { useEffect, useState } from "react";
import { useFiatRates } from "@/hooks/use-breez";
import { DEFAULT_FIAT_CURRENCY, getSelectedCurrency } from "@/lib/wallet/prefs";

export function useFiat(enabled: boolean = true) {
  const { data: rates = [] } = useFiatRates(enabled);
  const [currency, setCurrency] = useState<string>(() => getSelectedCurrency());

  useEffect(() => {
    setCurrency(getSelectedCurrency());
  }, []);

  const rate = rates.find((r) => r.coin === currency)?.value;
  const estableRate = rates.find((r) => r.coin === DEFAULT_FIAT_CURRENCY)?.value;
  return { rate, currency, estableRate };
}
