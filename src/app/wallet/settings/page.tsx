"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy as CopyIcon,
  EditPencil,
  WarningTriangle,
} from "iconoir-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusNote } from "@/components/ui/status-note";
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
  MAX_CLAIM_LEEWAY,
  parseClaimLeeway,
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
import { useT } from "@/lib/i18n/hook";
import { useCopy } from "@/hooks/use-copy";
import { useFormatRelativeTime } from "@/lib/wallet/relative-time";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { LightningAddressInfo } from "@breeztech/breez-sdk-spark";
import { LanguagePickerSection } from "@/components/ui/language-picker";
import {
  THEME_PREFERENCES,
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const USERNAME_RE = /^[a-z0-9._-]{1,32}$/;

const SECTION_TITLE = "font-serif text-h3 text-heading";
const SECTION_SUBTITLE = "mt-1 text-body-sm text-fg-muted";

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
    <div className="min-h-screen min-w-fit bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex items-center gap-2 mb-6">
          <button type="button"
            onClick={() => router.push("/wallet/home")}
            aria-label={t("common.back")}
            className="-ml-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg transition-colors duration-fast hover:bg-raised"
          >
            <ArrowLeft aria-hidden="true" className="h-6 w-6" />
          </button>
          <h1 className="font-serif text-h2 sm:text-h1 text-heading">{t("settings.title")}</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className={SECTION_TITLE}>{t("settings.lightningAddress.title")}</h2>
            <p className={SECTION_SUBTITLE}>
              {t("settings.lightningAddress.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {loadingAddress ? (
              <p className="text-body-sm text-fg-muted">{t("settings.lightningAddress.loading")}</p>
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
            <h2 className={SECTION_TITLE}>{t("settings.network.title")}</h2>
          </CardHeader>
          <CardContent>
            <p className="text-body-sm">
              <span className="text-fg-muted">{t("settings.network.active")}</span>
              <span className="font-mono font-medium capitalize">
                {SELECTED_BITCOIN_NETWORK}
              </span>
            </p>
          </CardContent>
        </Card>

        {isDriveBackupConfigured() && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className={SECTION_TITLE}>{t("settings.driveBackup.title")}</h2>
              <p className={SECTION_SUBTITLE}>
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
            <h2 className={SECTION_TITLE}>{t("settings.currency.title")}</h2>
            <p className={SECTION_SUBTITLE}>
              {t("settings.currency.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <CurrencyPickerSection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className={SECTION_TITLE}>{t("settings.language.title")}</h2>
            <p className={SECTION_SUBTITLE}>
              {t("settings.language.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <LanguagePickerSection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className={SECTION_TITLE}>{t("settings.theme.title")}</h2>
            <p className={SECTION_SUBTITLE}>{t("settings.theme.subtitle")}</p>
          </CardHeader>
          <CardContent>
            <ThemePickerSection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className={SECTION_TITLE}>{t("settings.claimLeeway.title")}</h2>
            <p className={SECTION_SUBTITLE}>
              {t("settings.claimLeeway.subtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <ClaimLeewaySection />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className={SECTION_TITLE}>{t("settings.help.title")}</h2>
          </CardHeader>
          <CardContent className="-mt-2 pb-4">
            <Link
              href="/faq"
              className="ism-link flex w-fit min-h-control items-center text-body"
            >
              {t("faq.title")}
            </Link>
            <Link
              href="/legal"
              className="ism-link flex w-fit min-h-control items-center text-body"
            >
              {t("legal.title")}
            </Link>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="flex items-center gap-2 font-serif text-h3 text-alert">
              <WarningTriangle aria-hidden="true" className="h-6 w-6 flex-none" />
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
  const formatRelativeTime = useFormatRelativeTime();
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
          <InlineError message={error} />
        )}
      </div>
    );
  }

  const lastSyncLabel = formatRelativeTime(lastSync);

  return (
    <div className="space-y-3">
      {email && (
        <div className="flex justify-between gap-4 text-body-sm">
          <span className="text-fg-muted">{t("settings.driveBackup.account")}</span>
          <span className="min-w-0 break-all text-right font-medium">{email}</span>
        </div>
      )}
      <div className="flex justify-between gap-4 text-body-sm">
        <span className="text-fg-muted">{t("settings.driveBackup.lastBackup")}</span>
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
        <InlineError message={error} />
      )}

      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        dismissable={!busy}
        title={t("settings.driveBackup.disconnectConfirmTitle")}
        description={t("settings.driveBackup.disconnectConfirmDescription")}
      >
        <div className="space-y-4">
          <StatusNote status="warning">
            {t("settings.driveBackup.disconnectWarning")}
          </StatusNote>
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
              variant="danger"
              size="lg"
              onClick={async () => {
                await handleDisconnect();
                setConfirmDisconnect(false);
              }}
              loading={busy}
              disabled={busy}
              className="flex-1"
            >
              {t("settings.driveBackup.disconnectSubmit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ThemePickerSection() {
  const t = useT();
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    setPreference(getThemePreference());
  }, []);

  return (
    <div role="group" aria-label={t("settings.theme.title")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {THEME_PREFERENCES.map((option) => {
        const selected = option === preference;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              setThemePreference(option);
              setPreference(option);
            }}
            className={`min-h-control rounded border-2 px-3 py-2 text-body-sm transition-colors duration-fast ${
              selected
                ? "border-strong font-semibold text-fg"
                : "border-hairline text-fg-muted hover:border-strong"
            }`}
          >
            {t(`settings.theme.${option}`)}
          </button>
        );
      })}
    </div>
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
    return <p className="text-body-sm text-fg-muted">{t("settings.currency.loading")}</p>;
  }

  const sorted = [...currencies].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="w-full min-h-field px-3 rounded border-1.5 border-input bg-surface text-fg text-body-sm hover:border-strong"
    >
      {sorted.map((c) => (
        <option key={c.id} value={c.id}>
          {c.id} - {c.info.name}
        </option>
      ))}
    </select>
  );
}

function ClaimLeewaySection() {
  const t = useT();
  const [savedValue, setSavedValue] = useState(() => getClaimLeeway());
  const [value, setValue] = useState(() => String(savedValue));
  const [saved, setSaved] = useState(false);

  const parsed = parseClaimLeeway(value);
  const invalid = parsed === null && value.trim() !== "";
  const dirty = parsed !== null && parsed !== savedValue;

  const handleSave = () => {
    if (parsed === null) return;
    setClaimLeeway(parsed);
    setSavedValue(parsed);
    setValue(String(parsed));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-3">
      <Input
        label={t("settings.claimLeeway.label")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        inputMode="numeric"
        error={invalid ? t("settings.claimLeeway.invalid", { max: MAX_CLAIM_LEEWAY }) : undefined}
        helperText={t("settings.claimLeeway.helper", { default: DEFAULT_CLAIM_LEEWAY })}
      />
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!dirty}
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
        // ignore: we'll surface a clear error on claim
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
          <p className="mt-2 break-all font-mono text-body-sm text-fg-muted">
            {trimmed}@{LNURL_DOMAIN ?? t("settings.claimUsername.breezDefault")}
          </p>
        )}
        {showAvailability && checkMutation.isPending && (
          <p className="mt-1 text-caption text-fg-muted">{t("settings.claimUsername.checking")}</p>
        )}
        {showAvailability && !checkMutation.isPending && available === true && (
          <p className="mt-1 flex items-center gap-2 text-caption text-success">
            <Check aria-hidden="true" className="h-5 w-5 flex-none" />
            {t("settings.claimUsername.available")}
          </p>
        )}
        {showAvailability && !checkMutation.isPending && available === false && (
          <p className="mt-1 flex items-center gap-2 text-caption text-alert">
            <WarningTriangle aria-hidden="true" className="h-5 w-5 flex-none" />
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
        <StatusNote status="error">{error}</StatusNote>
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
  const { copied, failed, copy } = useCopy();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-mono text-body break-all">{info.lightningAddress}</p>
        {info.description && (
          <p className="mt-1 text-body-sm text-fg-muted italic">
            &ldquo;{info.description}&rdquo;
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="rounded bg-paper p-4">
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
          onClick={() => copy(info.lightningAddress)}
        >
          {copied ? <Check aria-hidden="true" className="h-5 w-5" /> : <CopyIcon aria-hidden="true" className="h-5 w-5" />}
          <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("common.copy")}</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setEditOpen(true)}
        >
          <EditPencil aria-hidden="true" className="h-5 w-5" />
          <span>{t("settings.registeredAddress.editUsername")}</span>
        </Button>
      </div>

      {editOpen && (
        <EditUsernameModal
          currentAddress={info.lightningAddress}
          onClose={() => setEditOpen(false)}
          onChanged={() => {
            setEditOpen(false);
            onAfterChange();
          }}
        />
      )}
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
      <p className="mb-4 text-body-sm text-fg-muted">
        {t("settings.dangerZone.subtitle")}
      </p>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="w-full"
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
              variant="danger"
              size="lg"
              onClick={handle}
              loading={forgetting}
              disabled={
                forgetting || confirmText.trim().toLowerCase() !== t("forgetWallet.confirmWord")
              }
              className="flex-1"
            >
              {t("forgetWallet.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 text-body-sm text-alert">
      <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
      {message}
    </p>
  );
}
