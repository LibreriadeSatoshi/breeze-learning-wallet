"use client";

import { useEffect, useRef, useState } from "react";
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
import { useT } from "@/lib/i18n/hook";

type Status =
  | { kind: "working"; label: string }
  | { kind: "error"; message: string; returnTo: string | null };

export default function DriveCallbackPage() {
  const t = useT();
  const router = useRouter();
  const refreshHasVault = useWalletStore((s) => s.refreshHasVault);
  const [status, setStatus] = useState<Status>({
    kind: "working",
    label: t("driveCallback.signingIn"),
  });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const result = await handleDriveCallback(params);

      if (!result.ok) {
        setStatus({
          kind: "error",
          message: result.error,
          returnTo: result.intent?.returnTo ?? "/welcome",
        });
        return;
      }

      try {
        await runIntent(result.intent, result.token, refreshHasVault, setStatus, t);
        router.replace(result.intent.returnTo);
      } catch (e) {
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : t("driveCallback.operationFailed"),
          returnTo: result.intent.returnTo,
        });
      }
    })();
  }, [router, refreshHasVault, t]);

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
                  {t("common.goBack")}
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
  t: (key: string) => string,
): Promise<void> {
  switch (intent.type) {
    case "connect":
    case "backup": {
      setStatus({ kind: "working", label: t("driveCallback.uploading") });
      const blob = await loadVault();
      if (!blob) throw new Error(t("driveCallback.noVault"));
      await uploadVault(token, blob);
      return;
    }
    case "restore": {
      setStatus({ kind: "working", label: t("driveCallback.downloading") });
      const blob = await fetchVault(token);
      if (!blob) {
        throw new Error(t("driveCallback.noBackup"));
      }
      setStatus({ kind: "working", label: t("driveCallback.saving") });
      await saveVault(blob);
      await refreshHasVault();
      return;
    }
  }
}
