"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BitcoinCircle,
  Check,
  Copy as CopyIcon,
  EditPencil,
  Flash,
  Network,
} from "iconoir-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { useWalletStore } from "@/store/wallet-store";
import {
  useReceiveLightning,
  useGetBitcoinAddress,
  useLightningAddress,
  useRegisterLightningAddress,
  useReceiveSpark,
  useSparkAddress,
} from "@/hooks/use-breez";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import { generateRandomUsername } from "@/lib/wallet/username";
import { useT } from "@/lib/i18n/hook";
import { EditUsernameModal } from "@/components/wallet/edit-username-modal";
import { InvoiceCreator } from "@/components/wallet/invoice-creator";
import { QrCode } from "@/components/wallet/qr-code";
import { useCopy } from "@/hooks/use-copy";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { ReceivedPaymentDetails } from "@/lib/lightning/types";
import type { LightningAddressInfo } from "@breeztech/breez-sdk-spark";

type PaymentMethod = "lightning" | "bitcoin" | "spark";

const RECEIVE_METHODS: {
  id: PaymentMethod;
  icon: typeof Flash;
}[] = [
  { id: "lightning", icon: Flash },
  { id: "bitcoin", icon: BitcoinCircle },
  { id: "spark", icon: Network },
];


interface BitcoinReceive {
  address: string;
  fee: number;
}

export default function ReceivePage() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const { mutateAsync: getBtcAddress } = useGetBitcoinAddress();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("lightning");
  const [received, setReceived] = useState<ReceivedPaymentDetails | null>(null);
  const [result, setResult] = useState<BitcoinReceive | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBtcAddress()
      .then((r) => {
        if (!cancelled) setResult({ address: r.address, fee: r.fee });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "");
      });
    return () => {
      cancelled = true;
    };
  }, [getBtcAddress]);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  if (received) {
    return <SuccessView details={received} onDone={() => router.push("/wallet/home")} />;
  }

  return (
    <div>
      <div className="max-w-reading mx-auto px-4 py-6 sm:px-6">
        <ReceiveHeader onBack={() => router.back()} />

        <div className="mb-6 grid grid-cols-3 gap-4 border-b border-hairline">
          {RECEIVE_METHODS.map(({ id, icon: Icon }) => {
            const selected = paymentMethod === id;
            return (
              <button type="button"
                key={id}
                onClick={() => setPaymentMethod(id)}
                aria-pressed={selected}
                className={`-mb-px flex min-h-control flex-col items-start gap-1 border-b-2 pb-3 pt-2 text-left transition-colors duration-fast ${
                  selected
                    ? "border-strong text-fg"
                    : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                <span className={`flex items-center gap-2 text-body ${selected ? "font-semibold" : "font-medium"}`}>
                  <Icon aria-hidden="true" className="h-5 w-5 flex-none" />
                  {t(`receive.methods.${id}`)}
                </span>
                <span className="text-caption text-fg-muted">
                  {t(`receive.methods.${id}Subtitle`)}
                </span>
              </button>
            );
          })}
        </div>

        {paymentMethod === "lightning" && <LightningPanel onReceived={setReceived} />}
        {paymentMethod === "bitcoin" && (
          <BitcoinPanel
            onReceived={setReceived}
            error={error === null ? "" : error || t("receive.bitcoin.addressFailed")}
            result={result}
          />
        )}
        {paymentMethod === "spark" && <SparkPanel onReceived={setReceived} />}
      </div>
    </div>
  );
}

function ReceiveHeader({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 mb-6">
      <button type="button"
        onClick={onBack}
        aria-label={t("common.back")}
        className="-ml-3 inline-flex min-h-control min-w-[44px] items-center justify-center rounded text-fg hover:bg-raised transition-colors duration-fast"
      >
        <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      </button>
      <h1 className="font-serif text-h2 text-heading">{t("receive.title")}</h1>
    </div>
  );
}

function LightningPanel({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const t = useT();
  const { data: lnAddress, isLoading, refetch } = useLightningAddress(true);
  const registerMutation = useRegisterLightningAddress();
  const receiveMutation = useReceiveLightning();
  const [autoClaimError, setAutoClaimError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const tryingRef = useRef(false);
  const autoClaimedRef = useRef(false);

  const autoClaim = useCallback(async () => {
    if (tryingRef.current) return;
    tryingRef.current = true;
    setAutoClaimError("");
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = generateRandomUsername();
      try {
        await registerMutation.mutateAsync({ username });
        await refetch();
        tryingRef.current = false;
        return;
      } catch (e) {
        if (attempt === 2) {
          setAutoClaimError(
            e instanceof Error ? e.message : t("receive.lightning.setupFailed"),
          );
        }
      }
    }
    tryingRef.current = false;
  }, [registerMutation, refetch, t]);

  // Once per visit: a failure must wait for the user's retry, not loop.
  useEffect(() => {
    if (autoClaimedRef.current || isLoading || lnAddress) return;
    autoClaimedRef.current = true;
    void autoClaim();
  }, [isLoading, lnAddress, autoClaim]);

  if (isLoading || registerMutation.isPending) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8 text-center">
          <div aria-hidden="true" className="h-12 w-12 mx-auto mb-4 rounded-full border-2 border-track border-t-strong animate-spin" />
          <p className="text-body-sm text-fg-muted">
            {t("receive.lightning.settingUp")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (autoClaimError) {
    return (
      <div className="mb-6 space-y-4">
        <StatusNote status="error">{autoClaimError}</StatusNote>
        <Button variant="primary" onClick={autoClaim}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  if (!lnAddress) return null;

  return (
    <>
      <AddressCard info={lnAddress} onEdit={() => setEditOpen(true)} />
      <InvoiceCreator
        onReceived={onReceived}
        title={t("receive.invoice.title")}
        openLabel={t("receive.invoice.openLink")}
        isPending={receiveMutation.isPending}
        generate={({ amountSat, description }) =>
          receiveMutation.mutateAsync({
            amountSat,
            description: description || "Lightning payment",
          })
        }
      />
      {editOpen && (
        <EditUsernameModal
          currentAddress={lnAddress.lightningAddress}
          onClose={() => setEditOpen(false)}
          onChanged={() => {
            setEditOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

function AddressCard({
  info,
  onEdit,
}: {
  info: LightningAddressInfo;
  onEdit: () => void;
}) {
  const t = useT();
  const { copied, failed, copy } = useCopy();

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <h2 className="font-serif text-h3 text-heading">{t("receive.lightning.addressTitle")}</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          {t("receive.lightning.addressSubtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrCode value={info.lightningAddress} />
        <p className="text-center font-mono text-body break-all text-fg">
          {info.lightningAddress}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="primary"
            onClick={() => copy(info.lightningAddress)}
          >
            {copied ? <Check aria-hidden="true" className="h-5 w-5 flex-none" /> : <CopyIcon aria-hidden="true" className="h-5 w-5 flex-none" />}
            <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("common.copy")}</span>
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
          >
            <EditPencil aria-hidden="true" className="h-5 w-5 flex-none" />
            <span>{t("receive.lightning.editUsername")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function BitcoinPanel({
  onReceived,
  result,
  error,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
  result: { address: string, fee: number } | null;
  error: string;
}) {
  const t = useT();

  return (
    <AddressPanel
      address={result?.address}
      error={error}
      title={t("receive.bitcoin.title")}
      subtitle={t("receive.bitcoin.subtitle")}
      generatingLabel={t("receive.bitcoin.generating")}
      copyLabel={t("receive.bitcoin.copyAddress")}
      listenFor="deposit"
      onReceived={onReceived}
    />
  );
}

function SparkPanel({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const t = useT();
  const { data, isError } = useSparkAddress(true);
  const receiveMutation = useReceiveSpark();

  return (
    <>
      <AddressPanel
        address={data?.address}
        error={isError ? t("receive.spark.addressFailed") : ""}
        title={t("receive.spark.title")}
        subtitle={t("receive.spark.subtitle")}
        generatingLabel={t("receive.spark.generating")}
        copyLabel={t("receive.spark.copyAddress")}
        listenFor="spark"
        onReceived={onReceived}
      />
      <InvoiceCreator
        onReceived={onReceived}
        title={t("receive.spark.invoiceTitle")}
        openLabel={t("receive.spark.invoiceOpenLink")}
        isPending={receiveMutation.isPending}
        generate={({ amountSat, description }) =>
          receiveMutation.mutateAsync({ amountSat, description })
        }
      />
    </>
  );
}

function AddressPanel({
  address,
  error,
  title,
  subtitle,
  generatingLabel,
  copyLabel,
  listenFor,
  onReceived,
}: {
  address?: string;
  error: string;
  title: string;
  subtitle: string;
  generatingLabel: string;
  copyLabel: string;
  listenFor: ReceivedPaymentDetails["method"];
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const t = useT();
  const { copied, failed, copy } = useCopy();

  useEffect(() => {
    if (!address) return;
    const handler = (e: SdkEvent) => {
      if (e.type !== "paymentSucceeded") return;
      const p = e.payment;
      if (p.paymentType !== "receive" || p.method !== listenFor) return;
      // Conversion legs are internal transfers, not payments from anyone.
      const d = p.details;
      if ((d?.type === "spark" || d?.type === "token") && d.conversionInfo) return;
      onReceived({
        id: p.id,
        amountSat: Number(p.amount),
        feesSat: Number(p.fees),
        timestamp: p.timestamp,
        method: listenFor,
        status: p.status,
      });
    };
    return onSdkEvent(handler);
  }, [address, listenFor, onReceived]);


  if (error) {
    return (
      <StatusNote status="error" className="mb-6">{error}</StatusNote>
    );
  }

  if (!address) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8 text-center">
          <div aria-hidden="true" className="h-12 w-12 mx-auto mb-4 rounded-full border-2 border-track border-t-strong animate-spin" />
          <p className="text-body-sm text-fg-muted">{generatingLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <h2 className="font-serif text-h3 text-heading">{title}</h2>
        <p className="mt-1 text-body-sm text-fg-muted">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrCode value={address} />
        <p className="rounded border border-hairline bg-raised p-3 font-mono text-caption text-fg break-all">
          {address}
        </p>
        <Button
          variant="primary"
          onClick={() => copy(address)}
          className="w-full"
        >
          {copied ? <Check aria-hidden="true" className="h-5 w-5 flex-none" /> : <CopyIcon aria-hidden="true" className="h-5 w-5 flex-none" />}
          <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : copyLabel}</span>
        </Button>
      </CardContent>
    </Card>
  );
}

function SuccessView({
  details,
  onDone,
}: {
  details: ReceivedPaymentDetails;
  onDone: () => void;
}) {
  const t = useT();
  const formattedDate = new Date(details.timestamp * 1000).toLocaleString();
  return (
    <div className="max-w-reading mx-auto px-4 py-6 sm:px-6">
      <ReceiveHeader onBack={onDone} />
      <StatusNote status="success" className="mb-6">
        <h2 className="font-serif text-h2 text-heading">{t("receive.success.title")}</h2>
        <p className="mt-2 font-mono text-h2 font-medium tabular-nums text-fg">
          {details.amountSat.toLocaleString()} {t("send.sats")}
        </p>
      </StatusNote>
      <dl className="mb-6 divide-y divide-hairline border-y border-hairline text-body-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-fg-muted">{t("receive.success.method")}</dt>
          <dd className="capitalize text-fg">{details.method}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-fg-muted">{t("receive.success.fees")}</dt>
          <dd className="font-mono tabular-nums text-fg">{details.feesSat.toLocaleString()} {t("send.sats")}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-fg-muted">{t("receive.success.time")}</dt>
          <dd className="text-right font-mono tabular-nums text-fg">{formattedDate}</dd>
        </div>
      </dl>
      <Button variant="primary" size="lg" onClick={onDone} className="w-full">
        {t("common.done")}
      </Button>
    </div>
  );
}

