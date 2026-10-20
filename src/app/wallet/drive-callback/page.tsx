"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
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
    <div className="min-h-screen flex items-center px-4 py-6 sm:px-6">
      <div className="max-w-md mx-auto w-full">
        <Card>
          <CardContent className="pt-6">
            {status.kind === "working" ? (
              <div className="flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className="h-6 w-6 flex-none rounded-full border-2 border-track border-t-strong animate-spin"
                />
                <p className="text-body text-fg">{status.label}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <StatusNote status="error">{status.message}</StatusNote>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.replace(status.returnTo ?? "/welcome")}
                  className="w-full"
                >
                  {t("common.goBack")}
                </Button>
              </div>
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
