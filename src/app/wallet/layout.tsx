"use client";

import { useIdleLock } from "@/hooks/use-idle-lock";

// 5 minutes is the mainstream default (Sparrow, Phoenix, etc.).
const IDLE_LOCK_MS = 5 * 60 * 1000;

export default function WalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useIdleLock(IDLE_LOCK_MS);
  return <>{children}</>;
}
