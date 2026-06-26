"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy as CopyIcon,
  Pencil,
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
  useFiatCurrencies,
} from "@/hooks/use-breez";
import { EditUsernameModal } from "@/components/wallet/edit-username-modal";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import { useWalletStore } from "@/store/wallet-store";
import { SELECTED_BITCOIN_NETWORK, LNURL_DOMAIN } from "@/lib/config";
import {
  getClaimLeeway,
  setClaimLeeway,
  DEFAULT_CLAIM_LEEWAY,
  getSelectedCurrency,
  setSelectedCurrency,
} from "@/lib/wallet/prefs";
import {
  startDriveAuthFlow,
  disconnect as disconnectDrive,
  isDriveConnected,
  isDriveBackupConfigured,
  getLastSyncIso,
  getDriveEmail,
} from "@/lib/backup/drive-client";
import { useT, useLocale } from "@/lib/i18n/hook";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/types";
import { formatRelativeTime } from "@/lib/wallet/relative-time";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { LightningAddressInfo } from "@breeztech/breez-sdk-spark";

const USERNAME_RE = /^[a-z0-9._-]{1,32}$/;

export default function SettingsPage() {
  const t = useT();
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
            aria-label={t("common.back")}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("settings.lightningAddress.title")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("settings.lightningAddress.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {loadingAddress ? (
              <p className="text-sm text-gray-500">{t("settings.lightningAddress.loading")}</p>
            ) : lightningAddress ? (
              <RegisteredAddress
                info={lightningAddress}
                onAfterChange={() => refetchAddress()}
              />
            ) : (
              <ClaimUsername onClaimed={() => refetchAddress()} />
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("settings.network.title")}</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">{t("settings.network.active")}</span>
              <span className="font-medium capitalize">
                {SELECTED_BITCOIN_NETWORK}
              </span>
            </p>
          </CardContent>
        </Card>

        {isDriveBackupConfigured() && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">{t("settings.driveBackup.title")}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t("settings.driveBackup.subtitle")}
              </p>
            </CardHeader>
            <CardContent>
              <DriveBackupSection />
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("settings.currency.title")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("settings.currency.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <CurrencyPickerSection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("settings.language.title")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("settings.language.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <LanguagePickerSection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">{t("settings.claimLeeway.title")}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t("settings.claimLeeway.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <ClaimLeewaySection />
          </CardContent>
        </Card>

        <Card className="mb-6 border-red-200 dark:border-red-900">
          <CardHeader>
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">
              {t("settings.dangerZone.title")}
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

function DriveBackupSection() {
  const t = useT();
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    setConnected(isDriveConnected());
    setLastSync(getLastSyncIso());
    setEmail(getDriveEmail());
  }, []);

  const handleConnect = () => {
    setError("");
    setBusy(true);
    try {
      startDriveAuthFlow({ type: "connect", returnTo: "/wallet/settings" });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : t("settings.driveBackup.connectStartFailed"));
    }
  };

  const handleBackupNow = () => {
    setError("");
    setBusy(true);
    try {
      startDriveAuthFlow({ type: "backup", returnTo: "/wallet/settings" });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : t("settings.driveBackup.backupStartFailed"));
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await disconnectDrive();
      setConnected(false);
      setLastSync(null);
      setEmail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.driveBackup.disconnectFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="space-y-3">
        <Button
          variant="primary"
          onClick={handleConnect}
          loading={busy}
          disabled={busy}
          className="w-full"
        >
          {t("settings.driveBackup.connect")}
        </Button>
        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
      </div>
    );
  }

  const lastSyncLabel = formatRelativeTime(lastSync);

  return (
    <div className="space-y-3">
      {email && (
        <div className="text-sm flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">{t("settings.driveBackup.account")}</span>
          <span className="font-medium">{email}</span>
        </div>
      )}
      <div className="text-sm flex justify-between">
        <span className="text-gray-600 dark:text-gray-400">{t("settings.driveBackup.lastBackup")}</span>
        <span className="font-medium">{lastSyncLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="primary"
          onClick={handleBackupNow}
          loading={busy}
          disabled={busy}
        >
          {t("settings.driveBackup.backupNow")}
        </Button>
        <Button
          variant="outline"
          onClick={() => setConfirmDisconnect(true)}
          disabled={busy}
        >
          {t("settings.driveBackup.disconnect")}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        dismissable={!busy}
        title={t("settings.driveBackup.disconnectConfirmTitle")}
        description={t("settings.driveBackup.disconnectConfirmDescription")}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {t("settings.driveBackup.disconnectWarning")}
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setConfirmDisconnect(false)}
              disabled={busy}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={async () => {
                await handleDisconnect();
                setConfirmDisconnect(false);
              }}
              loading={busy}
              disabled={busy}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t("settings.driveBackup.disconnectSubmit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LanguagePickerSection() {
  const { locale, setLocale } = useLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}

function CurrencyPickerSection() {
  const t = useT();
  const { data: currencies = [], isLoading } = useFiatCurrencies();
  const [selected, setSelected] = useState(() => getSelectedCurrency());

  const handleChange = (value: string) => {
    setSelected(value);
    setSelectedCurrency(value);
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">{t("settings.currency.loading")}</p>;
  }

  const sorted = [...currencies].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
    >
      {sorted.map((c) => (
        <option key={c.id} value={c.id}>
          {c.id} — {c.info.name}
        </option>
      ))}
    </select>
  );
}

function ClaimLeewaySection() {
  const t = useT();
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
        label={t("settings.claimLeeway.label")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value.replace(/[^0-9]/g, ""));
          setSaved(false);
        }}
        inputMode="numeric"
        helperText={t("settings.claimLeeway.helper", { default: DEFAULT_CLAIM_LEEWAY })}
      />
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!dirty || invalid}
        className="w-full"
      >
        {saved ? t("settings.claimLeeway.saved") : t("common.save")}
      </Button>
    </div>
  );
}

function ClaimUsername({ onClaimed }: { onClaimed: () => void }) {
  const t = useT();
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
      setError(t("settings.claimUsername.invalid"));
      return;
    }
    try {
      await registerMutation.mutateAsync({
        username: trimmed,
        description: description.trim() || undefined,
      });
      onClaimed();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.claimUsername.failed"));
    }
  };

  const showAvailability =
    username.trim().length > 0 && USERNAME_RE.test(username.trim().toLowerCase());
  const trimmed = username.trim().toLowerCase();

  return (
    <div className="space-y-4">
      <div>
        <Input
          label={t("settings.claimUsername.usernameLabel")}
          placeholder={t("settings.claimUsername.usernamePlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {trimmed && (
          <p className="mt-2 text-sm font-mono text-gray-600 dark:text-gray-400">
            {trimmed}@{LNURL_DOMAIN ?? t("settings.claimUsername.breezDefault")}
          </p>
        )}
        {showAvailability && checkMutation.isPending && (
          <p className="mt-1 text-xs text-gray-500">{t("settings.claimUsername.checking")}</p>
        )}
        {showAvailability && !checkMutation.isPending && available === true && (
          <p className="mt-1 text-xs text-green-700 dark:text-green-400">
            {t("settings.claimUsername.available")}
          </p>
        )}
        {showAvailability && !checkMutation.isPending && available === false && (
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            {t("settings.claimUsername.taken")}
          </p>
        )}
      </div>
      <Input
        label={t("settings.claimUsername.descriptionLabel")}
        placeholder={t("settings.claimUsername.descriptionPlaceholder")}
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
        {t("settings.claimUsername.claim")}
      </Button>
    </div>
  );
}

function RegisteredAddress({
  info,
  onAfterChange,
}: {
  info: LightningAddressInfo;
  onAfterChange: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.lightningAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, ignore
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
          <span>{copied ? t("common.copied") : t("common.copy")}</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center justify-center gap-2"
        >
          <Pencil className="w-4 h-4" />
          <span>{t("settings.registeredAddress.editUsername")}</span>
        </Button>
      </div>

      <EditUsernameModal
        open={editOpen}
        currentAddress={info.lightningAddress}
        onClose={() => setEditOpen(false)}
        onChanged={() => {
          setEditOpen(false);
          onAfterChange();
        }}
      />
    </div>
  );
}

function ForgetWalletSection({ onForget }: { onForget: () => Promise<void> }) {
  const t = useT();
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
        {t("settings.dangerZone.subtitle")}
      </p>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
      >
        {t("settings.dangerZone.button")}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (forgetting) return;
          setOpen(false);
          setConfirmText("");
        }}
        dismissable={!forgetting}
        title={t("forgetWallet.title")}
        description={t("forgetWallet.description")}
      >
        <div className="space-y-4">
          <Input
            label={t("forgetWallet.confirmLabel")}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t("forgetWallet.confirmPlaceholder")}
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
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={handle}
              loading={forgetting}
              disabled={
                forgetting || confirmText.trim().toLowerCase() !== t("forgetWallet.confirmWord")
              }
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {t("forgetWallet.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
