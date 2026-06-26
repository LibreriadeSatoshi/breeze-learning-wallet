"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  useCheckLightningAddressAvailable,
  useRegisterLightningAddress,
} from "@/hooks/use-breez";
import { useT } from "@/lib/i18n/hook";

const USERNAME_RE = /^[a-z0-9._-]{1,32}$/;

interface EditUsernameModalProps {
  open: boolean;
  currentAddress: string;
  onClose: () => void;
  onChanged: () => void;
}

export function EditUsernameModal({
  open,
  currentAddress,
  onClose,
  onChanged,
}: EditUsernameModalProps) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const checkMutation = useCheckLightningAddressAvailable();
  const registerMutation = useRegisterLightningAddress();

  useEffect(() => {
    if (!open) {
      setUsername("");
      setAvailable(null);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    setAvailable(null);
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || !USERNAME_RE.test(trimmed)) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const ok = await checkMutation.mutateAsync(trimmed);
        if (!cancelled) setAvailable(ok);
      } catch {
        // ignore — surfaces on save
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const save = async () => {
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!USERNAME_RE.test(trimmed)) {
      setError(t("editUsername.invalid"));
      return;
    }
    try {
      await registerMutation.mutateAsync({ username: trimmed });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editUsername.failed"));
    }
  };

  const trimmed = username.trim().toLowerCase();
  const showAvailability = trimmed.length > 0 && USERNAME_RE.test(trimmed);

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={!registerMutation.isPending}
      title={t("editUsername.title")}
      description={t("editUsername.description", { address: currentAddress })}
    >
      <div className="space-y-4">
        <Input
          label={t("editUsername.newLabel")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        {showAvailability && checkMutation.isPending && (
          <p className="text-xs text-gray-500">{t("editUsername.checking")}</p>
        )}
        {showAvailability && !checkMutation.isPending && available === true && (
          <p className="text-xs text-green-700 dark:text-green-400">{t("editUsername.available")}</p>
        )}
        {showAvailability && !checkMutation.isPending && available === false && (
          <p className="text-xs text-red-700 dark:text-red-400">{t("editUsername.taken")}</p>
        )}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        <div className="flex gap-3">
          <Button
            variant="ghost"
            size="lg"
            onClick={onClose}
            disabled={registerMutation.isPending}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={save}
            loading={registerMutation.isPending}
            disabled={registerMutation.isPending || available !== true}
            className="flex-1"
          >
            {t("editUsername.replace")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
