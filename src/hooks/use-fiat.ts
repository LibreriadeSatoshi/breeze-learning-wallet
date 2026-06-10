import { useEffect, useState } from "react";
import { useFiatRates } from "@/hooks/use-breez";
import { getSelectedCurrency } from "@/lib/wallet/prefs";

export function useFiat(enabled: boolean = true) {
  const { data: rates = [] } = useFiatRates(enabled);
  const [currency, setCurrency] = useState<string>(() => getSelectedCurrency());

  useEffect(() => {
    setCurrency(getSelectedCurrency());
  }, []);

  const rate = rates.find((r) => r.coin === currency)?.value;
  return { rate, currency };
}
