"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  handleDriveCallback,
  uploadVault,
  fetchVault,
  type DriveIntent,
} from "@/lib/backup/drive-client";
import { loadVault, saveVault } from "@/lib/storage/vault-storage";
import { useWalletStore } from "@/store/wallet-store";

type Status =
  | { kind: "working"; label: string }
  | { kind: "error"; message: string; returnTo: string | null };

export default function DriveCallbackPage() {
  const router = useRouter();
  const refreshHasVault = useWalletStore((s) => s.refreshHasVault);
  const [status, setStatus] = useState<Status>({
    kind: "working",
    label: "Finishing Google sign-in…",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const result = await handleDriveCallback(params);
      if (cancelled) return;

      if (!result.ok) {
        setStatus({
          kind: "error",
          message: result.error,
          returnTo: result.intent?.returnTo ?? "/welcome",
        });
        return;
      }

      try {
        await runIntent(result.intent, result.token, refreshHasVault, setStatus);
        if (cancelled) return;
        router.replace(result.intent.returnTo);
      } catch (e) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Drive operation failed.",
          returnTo: result.intent.returnTo,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, refreshHasVault]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-900 flex items-center">
      <div className="max-w-md mx-auto w-full">
        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            {status.kind === "working" ? (
              <>
                <div className="w-12 h-12 mx-auto rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {status.label}
                </p>
              </>
            ) : (
              <>
                <div className="flex justify-center text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="w-10 h-10" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {status.message}
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.replace(status.returnTo ?? "/welcome")}
                  className="w-full"
                >
                  Go back
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function runIntent(
  intent: DriveIntent,
  token: string,
  refreshHasVault: () => Promise<void>,
  setStatus: (s: Status) => void,
): Promise<void> {
  switch (intent.type) {
    case "connect":
    case "backup": {
      setStatus({ kind: "working", label: "Uploading encrypted backup…" });
      const blob = await loadVault();
      if (!blob) throw new Error("No wallet to back up.");
      await uploadVault(token, blob);
      return;
    }
    case "restore": {
      setStatus({ kind: "working", label: "Downloading your encrypted vault…" });
      const blob = await fetchVault(token);
      if (!blob) {
        throw new Error(
          "No backup found in your Google Drive. Did you back up from this app before?",
        );
      }
      setStatus({ kind: "working", label: "Saving to this device…" });
      await saveVault(blob);
      await refreshHasVault();
      return;
    }
  }
}
