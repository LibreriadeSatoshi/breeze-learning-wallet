"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy as CopyIcon,
  TriangleAlert,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  useLightningAddress,
  useCheckLightningAddressAvailable,
  useRegisterLightningAddress,
  useDeleteLightningAddress,
} from "@/hooks/use-breez";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import { useWalletStore } from "@/store/wallet-store";
import { SELECTED_BITCOIN_NETWORK, LNURL_DOMAIN } from "@/lib/config";
import { getClaimLeeway, setClaimLeeway, DEFAULT_CLAIM_LEEWAY } from "@/lib/wallet/prefs";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { LightningAddressInfo } from "@breeztech/breez-sdk-spark";

const USERNAME_RE = /^[a-z0-9._-]{1,32}$/;

export default function SettingsPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const destroyVault = useWalletStore((s) => s.destroyVault);

  const {
    data: lightningAddress,
    isLoading: loadingAddress,
    refetch: refetchAddress,
  } = useLightningAddress(isUnlocked);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  useEffect(() => {
    const handler = (e: SdkEvent) => {
      if (e.type === "lightningAddressChanged") refetchAddress();
    };
    return onSdkEvent(handler);
  }, [refetchAddress]);

  if (!isUnlocked) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push("/wallet/home")}
            aria-label="Back"
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Lightning address</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              A human-readable address (like an email) that anyone can pay over
              Lightning.
            </p>
          </CardHeader>
          <CardContent>
            {loadingAddress ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : lightningAddress ? (
              <RegisteredAddress
                info={lightningAddress}
                onAfterDelete={() => refetchAddress()}
              />
            ) : (
              <ClaimUsername onClaimed={() => refetchAddress()} />
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Network</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">Active: </span>
              <span className="font-medium capitalize">
                {SELECTED_BITCOIN_NETWORK}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Auto-claim deposits</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              On-chain deposits are claimed automatically when the network fee
              rate is at most <em>recommended + leeway</em> sat/vB. Higher leeway
              means more claims succeed but you may overpay during quiet periods.
            </p>
          </CardHeader>
          <CardContent>
            <ClaimLeewaySection />
          </CardContent>
        </Card>

        <Card className="mb-6 border-red-200 dark:border-red-900">
          <CardHeader>
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
              Danger zone
            </h2>
          </CardHeader>
          <CardContent>
            <ForgetWalletSection
              onForget={async () => {
                await destroyVault();
                router.push("/welcome");
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClaimLeewaySection() {
  const [value, setValue] = useState(() => String(getClaimLeeway()));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return;
    setClaimLeeway(n);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const dirty = value.trim() !== String(getClaimLeeway());
  const invalid = value.trim() === "" || isNaN(parseInt(value, 10));

  return (
    <div className="space-y-3">
      <Input
        label="Leeway (sat/vB)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value.replace(/[^0-9]/g, ""));
          setSaved(false);
        }}
        inputMode="numeric"
        helperText={`Default ${DEFAULT_CLAIM_LEEWAY}. Takes effect after the next wallet restart.`}
      />
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!dirty || invalid}
        className="w-full"
      >
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
}

function ClaimUsername({ onClaimed }: { onClaimed: () => void }) {
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const checkMutation = useCheckLightningAddressAvailable();
  const registerMutation = useRegisterLightningAddress();

  useEffect(() => {
    setAvailable(null);
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;
    if (!USERNAME_RE.test(trimmed)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const ok = await checkMutation.mutateAsync(trimmed);
        if (!cancelled) setAvailable(ok);
      } catch {
        // ignore — we'll surface a clear error on claim
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const claim = async () => {
    setError("");
    const trimmed = username.trim().toLowerCase();
    if (!USERNAME_RE.test(trimmed)) {
      setError("Use lowercase letters, numbers, dots, underscores, hyphens (max 32).");
      return;
    }
    try {
      await registerMutation.mutateAsync({
        username: trimmed,
        description: description.trim() || undefined,
      });
      onClaimed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register address");
    }
  };

  const showAvailability =
    username.trim().length > 0 && USERNAME_RE.test(username.trim().toLowerCase());
  const trimmed = username.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <div>
        <Input
          label="Username"
          placeholder="alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {trimmed && (
          <p className="mt-2 text-sm font-mono text-gray-600 dark:text-gray-400">
            {trimmed}@{LNURL_DOMAIN ?? "<breez default>"}
          </p>
        )}
        {showAvailability && checkMutation.isPending && (
          <p className="mt-1 text-xs text-gray-500">Checking availability…</p>
        )}
        {showAvailability && !checkMutation.isPending && available === true && (
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            Available
          </p>
        )}
        {showAvailability && !checkMutation.isPending && available === false && (
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            Taken — pick another
          </p>
        )}
      </div>
      <Input
        label="Description (optional)"
        placeholder="What senders will see"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={100}
      />
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      <Button
        variant="primary"
        size="lg"
        onClick={claim}
        loading={registerMutation.isPending}
        disabled={
          registerMutation.isPending ||
          available !== true ||
          !USERNAME_RE.test(trimmed)
        }
        className="w-full"
      >
        Claim address
      </Button>
    </div>
  );
}

function RegisteredAddress({
  info,
  onAfterDelete,
}: {
  info: LightningAddressInfo;
  onAfterDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteLightningAddress();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.lightningAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, ignore
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync();
      setConfirmDelete(false);
      onAfterDelete();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-mono text-lg break-all">{info.lightningAddress}</p>
        {info.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
            &ldquo;{info.description}&rdquo;
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="p-3 bg-white rounded-lg">
          <QRCodeSVG
            value={info.lightningAddress}
            size={180}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#000000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          onClick={copy}
          className="inline-flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this Lightning address?"
        description="The username will be released back to the pool. Anyone can claim it next."
        dismissable={!deleteMutation.isPending}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Payments to {info.lightningAddress} will stop working after this.
              You can still receive via raw invoices.
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ForgetWalletSection({ onForget }: { onForget: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [forgetting, setForgetting] = useState(false);

  const handle = async () => {
    setForgetting(true);
    try {
      await onForget();
    } finally {
      setForgetting(false);
    }
  };

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Erase the encrypted wallet from this browser. Funds remain controlled
        by your recovery phrase.
      </p>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
      >
        Forget this wallet
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (forgetting) return;
          setOpen(false);
          setConfirmText("");
        }}
        dismissable={!forgetting}
        title="Forget this wallet?"
        description="This erases the encrypted wallet from this browser. Without your recovery phrase, anything in this wallet is gone for good."
      >
        <div className="space-y-4">
          <Input
            label='Type "forget" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="forget"
            disabled={forgetting}
            autoFocus
          />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              disabled={forgetting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handle}
              loading={forgetting}
              disabled={
                forgetting || confirmText.trim().toLowerCase() !== "forget"
              }
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Forget wallet
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
