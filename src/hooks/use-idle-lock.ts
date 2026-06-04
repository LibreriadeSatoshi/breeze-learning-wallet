"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWalletStore } from "@/store/wallet-store";

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

export function useIdleLock(timeoutMs: number) {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const lock = useWalletStore((s) => s.lock);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isUnlocked || typeof window === "undefined") return;

    const reset = () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lock();
        router.push("/welcome");
      }, timeoutMs);
    };

    reset();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [isUnlocked, lock, router, timeoutMs]);
}
