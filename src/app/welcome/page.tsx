"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";
import { loginWithGitHub } from "@/lib/auth/github";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useWalletStore } from "@/store/wallet-store";

export default function WelcomePage() {
  const router = useRouter();
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { githubUser, clearAuth } = useAuthStore();
  const { isInitialized } = useWalletStore();

  // Auto-redirect to wallet home if already logged in and wallet is initialized
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && githubUser && isInitialized) {
      router.push("/wallet/home");
    }
  }, [mounted, githubUser, isInitialized, router]);

  const createWalletHandler = async () => {
    setCreatingWallet(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setCreatingWallet(false);
    router.push("/wallet/create");
  };

  const restoreWalletHandler = () => {
    router.push("/wallet/restore");
  };

  const handleGitHubLogin = () => {
    loginWithGitHub();
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      clearAuth();
    }
  };

  const canCreateWallet = !!githubUser;

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10">
      {githubUser && (
        <div className="absolute top-4 right-4">
          <div className="relative group">
            <div className="relative">
              <img
                src={githubUser.avatar_url}
                alt={githubUser.login}
                className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700 cursor-pointer"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 bg-green-500" />
            </div>

            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <div className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={githubUser.avatar_url}
                    alt={githubUser.login}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {githubUser.name || githubUser.login}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {githubUser.email}
                    </p>
                  </div>
                </div>

                <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded">
                  <p className="text-xs text-green-800 dark:text-green-300">
                    ✅ Logged in
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 py-2 px-3 rounded transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-end pb-20">
        <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">₿</span>
        </div>
        <h1 className="text-4xl font-bold mb-4 text-center">{APP_NAME}</h1>
        <p className="text-center text-gray-600 dark:text-gray-400 max-w-xs">
          Your Bitcoin & Lightning wallet for sovereign payments
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-3 max-w-md mx-auto w-full">
        <Button
          variant="primary"
          size="lg"
          onClick={createWalletHandler}
          loading={creatingWallet}
          disabled={!canCreateWallet}
          className="w-full"
        >
          {creatingWallet ? "Creating wallet..." : "Create new wallet"}
        </Button>

        {!canCreateWallet && (
          <p className="text-center text-sm text-gray-500">
            {!githubUser
              ? "Please login with GitHub to create a wallet"
              : "You must be authorized to create a wallet"}
          </p>
        )}

        {!githubUser && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">
                  or
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={handleGitHubLogin}
              disabled={creatingWallet}
              className="w-full flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                  clipRule="evenodd"
                />
              </svg>
              Continue with GitHub
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="lg"
          onClick={restoreWalletHandler}
          disabled={creatingWallet}
          className="w-full"
        >
          Restore wallet
        </Button>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
