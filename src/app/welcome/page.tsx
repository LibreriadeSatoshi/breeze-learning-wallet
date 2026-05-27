"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { useWalletStore } from "@/store/wallet-store";

export default function WelcomePage() {
  const router = useRouter();
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { isInitialized } = useWalletStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isInitialized) {
      router.push("/wallet/home");
    }
  }, [mounted, isInitialized, router]);

  const handleCreateWallet = () => {
    setCreatingWallet(true);
    router.push("/wallet/create");
  };

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10">
      <div className="flex-1 flex flex-col items-center justify-end pb-20">
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl transform transition-transform hover:scale-105">
            <span className="text-5xl">🎓</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-cyan-400 to-sky-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">₿</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold mb-3 text-center bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
          {APP_NAME}
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 max-w-sm px-4">
          A non-custodial Bitcoin & Lightning wallet. Your keys, your coins.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-4 max-w-md mx-auto w-full px-6">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCreateWallet}
          loading={creatingWallet}
          className="w-full shadow-lg hover:shadow-xl transition-shadow"
        >
          {creatingWallet ? "Creating wallet..." : "🚀 Create new wallet"}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-400">
              Already have a wallet?
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="lg"
          onClick={() => router.push("/wallet/restore")}
          disabled={creatingWallet}
          className="w-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          🔑 Restore wallet
        </Button>
      </div>

      <div className="text-center pb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 px-8">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
