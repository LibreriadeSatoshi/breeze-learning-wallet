"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { APP_NAME } from "@/lib/config";
import { useWalletStore } from "@/store/wallet-store";

export default function WelcomePage() {
  const router = useRouter();
  const hasVault = useWalletStore((s) => s.hasVault);
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const isBootstrapped = useWalletStore((s) => s.isBootstrapped);
  const bootstrap = useWalletStore((s) => s.bootstrap);
  const unlock = useWalletStore((s) => s.unlock);
  const destroyVault = useWalletStore((s) => s.destroyVault);

  const [creatingWallet, setCreatingWallet] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [showForget, setShowForget] = useState(false);
  const [forgetConfirm, setForgetConfirm] = useState("");
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isBootstrapped && isUnlocked) {
      router.push("/wallet/home");
    }
  }, [isBootstrapped, isUnlocked, router]);

  const handleCreateWallet = () => {
    setCreatingWallet(true);
    router.push("/wallet/create");
  };

  const handleUnlock = async () => {
    if (!password) {
      setError("Enter your wallet password");
      return;
    }
    setError("");
    setUnlocking(true);
    try {
      await unlock(password);
      router.push("/wallet/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock wallet");
      setUnlocking(false);
      setPassword("");
    }
  };

  const handleForget = async () => {
    setForgetting(true);
    try {
      await destroyVault();
      setShowForget(false);
      setForgetConfirm("");
      setPassword("");
      setError("");
    } finally {
      setForgetting(false);
    }
  };

  if (!isBootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10">
      <div className="flex-1 flex flex-col items-center justify-end pb-20">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl mb-8">
          <span className="text-5xl font-bold text-white">₿</span>
        </div>
        <h1 className="text-5xl font-bold mb-3 text-center bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
          {APP_NAME}
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 max-w-sm px-4">
          A non-custodial Bitcoin & Lightning wallet. Your keys, your coins.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-4 max-w-md mx-auto w-full px-6">
        {hasVault ? (
          <Card className="shadow-lg">
            <CardContent className="pt-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-1">Unlock wallet</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter your wallet password to continue.
                </p>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wallet password"
                disabled={unlocking}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
                autoFocus
              />
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={handleUnlock}
                loading={unlocking}
                disabled={unlocking}
                className="w-full"
              >
                {unlocking ? "Unlocking…" : "Unlock"}
              </Button>
              <button
                onClick={() => router.push("/wallet/restore")}
                className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Forgot password? Restore from recovery phrase
              </button>
              <button
                onClick={() => setShowForget(true)}
                className="w-full text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              >
                Forget this wallet on this device
              </button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateWallet}
              loading={creatingWallet}
              className="w-full shadow-lg hover:shadow-xl transition-shadow"
            >
              {creatingWallet ? "Creating wallet..." : "Create new wallet"}
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
              Restore wallet
            </Button>
          </>
        )}
      </div>

      <div className="text-center pb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 px-8">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      <Modal
        open={showForget}
        onClose={() => {
          if (forgetting) return;
          setShowForget(false);
          setForgetConfirm("");
        }}
        dismissable={!forgetting}
        title="Forget this wallet?"
        description="This erases the encrypted wallet from this browser. Funds remain controlled by your recovery phrase — without it, anything in this wallet is gone for good."
      >
        <div className="space-y-4">
          <Input
            label='Type "forget" to confirm'
            value={forgetConfirm}
            onChange={(e) => setForgetConfirm(e.target.value)}
            placeholder="forget"
            disabled={forgetting}
            autoFocus
          />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setShowForget(false);
                setForgetConfirm("");
              }}
              disabled={forgetting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleForget}
              loading={forgetting}
              disabled={
                forgetting || forgetConfirm.trim().toLowerCase() !== "forget"
              }
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Forget wallet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
