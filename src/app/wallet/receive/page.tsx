"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  Copy as CopyIcon,
  Pencil,
  Waypoints,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
  icon: LucideIcon;
  iconClass: string;
}[] = [
  { id: "lightning", icon: Zap, iconClass: "text-blue-600 dark:text-blue-400" },
  { id: "bitcoin", icon: Bitcoin, iconClass: "text-orange-500" },
  { id: "spark", icon: Waypoints, iconClass: "text-purple-600 dark:text-purple-400" },
];


interface BitcoinReceive {
  address: string;
  fee: number;
}






export default function ReceivePage() {
  const t = useT();
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("lightning");
  const [received, setReceived] = useState<ReceivedPaymentDetails | null>(null);

  useEffect(() => {
    if (!isUnlocked) router.push("/welcome");
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  if (received) {
    return <SuccessView details={received} onDone={() => router.push("/wallet/home")} />;
  }

  return (
    <div className="min-h-screen min-w-fit bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button type="button"
            onClick={() => router.back()}
            aria-label={t("common.back")}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">{t("receive.title")}</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-3">
              {RECEIVE_METHODS.map(({ id, icon: Icon, iconClass }) => (
                <button type="button"
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    paymentMethod === id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className={`w-6 h-6 ${iconClass}`} />
                  <div className="font-medium">{t(`receive.methods.${id}`)}</div>
                  <div className="text-xs text-gray-500">
                    {t(`receive.methods.${id}Subtitle`)}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {paymentMethod === "lightning" && <LightningPanel onReceived={setReceived} />}
        {paymentMethod === "bitcoin" && <BitcoinPanel onReceived={setReceived} />}
        {paymentMethod === "spark" && <SparkPanel onReceived={setReceived} />}
      </div>
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

  useEffect(() => {
    if (!isLoading && !lnAddress && !registerMutation.isPending) {
      autoClaim();
    }
  }, [isLoading, lnAddress, registerMutation.isPending, autoClaim]);

  if (isLoading || registerMutation.isPending) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("receive.lightning.settingUp")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (autoClaimError) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            {autoClaimError}
          </p>
          <Button variant="primary" onClick={autoClaim}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
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
      <CardHeader>
        <h2 className="text-lg font-semibold">{t("receive.lightning.addressTitle")}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("receive.lightning.addressSubtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrCode value={info.lightningAddress} />
        <p className="text-center font-mono text-base break-all">
          {info.lightningAddress}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="primary"
            onClick={() => copy(info.lightningAddress)}
            className="inline-flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 min-w-4" /> : <CopyIcon className="w-4 h-4 min-w-4" />}
            <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("common.copy")}</span>
          </Button>
          <Button
            variant="outline"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4 min-w-4" />
            <span>{t("receive.lightning.editUsername")}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function BitcoinPanel({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const t = useT();
  const getMutation = useGetBitcoinAddress();
  const [result, setResult] = useState<BitcoinReceive | null>(null);
  const [error, setError] = useState("");
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    (async () => {
      try {
        const r = await getMutation.mutateAsync();
        setResult({ address: r.address, fee: r.fee });
      } catch (e) {
        setError(e instanceof Error ? e.message : t("receive.bitcoin.addressFailed"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!address) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{generatingLabel}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <QrCode value={address} />
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg break-all font-mono text-xs">
          {address}
        </div>
        <Button
          variant="primary"
          onClick={() => copy(address)}
          className="w-full inline-flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6 min-w-fit">
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-9 h-9 text-green-600 dark:text-green-400" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("receive.success.title")}</h2>
            <p className="text-4xl font-bold text-orange-500 mt-4 mb-1">
              {details.amountSat.toLocaleString()} {t("send.sats")}
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-6 mb-6 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t("receive.success.method")}</span>
                <span className="font-medium capitalize">{details.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t("receive.success.fees")}</span>
                <span className="font-medium">{details.feesSat.toLocaleString()} {t("send.sats")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t("receive.success.time")}</span>
                <span className="font-medium text-xs">{formattedDate}</span>
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={onDone} className="w-full">
              {t("common.done")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

