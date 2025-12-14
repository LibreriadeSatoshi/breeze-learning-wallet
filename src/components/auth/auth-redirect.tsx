"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useWalletStore } from "@/store/wallet-store";

export function AuthRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { githubUser } = useAuthStore();
  const { isInitialized } = useWalletStore();

  useEffect(() => {
    if (pathname?.startsWith("/auth/")) {
      return;
    }

    if (pathname === "/welcome" && githubUser && isInitialized) {
      router.push("/wallet/home");
      return;
    }

    if (pathname?.startsWith("/wallet/") && !githubUser) {
      router.push("/welcome");
      return;
    }

    if (
      pathname?.startsWith("/wallet/") &&
      !isInitialized &&
      pathname !== "/wallet/create" &&
      pathname !== "/wallet/restore"
    ) {
      router.push("/welcome");
    }
  }, [pathname, githubUser, isInitialized, router]);

  return null;
}

