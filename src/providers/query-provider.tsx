"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect } from "react";
import { useWalletStore } from "@/store/wallet-store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      gcTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  // Cached SDK data belongs to one wallet; keeping it across a lock or restore
  // would show the previous wallet's balance or Lightning address.
  useEffect(
    () =>
      useWalletStore.subscribe((state, prev) => {
        if (state.session !== prev.session) queryClient.clear();
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
