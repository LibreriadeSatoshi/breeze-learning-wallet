"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  Clock,
  Copy as CopyIcon,
  Pencil,
  Share2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useWalletStore } from "@/store/wallet-store";
import {
  useReceiveLightning,
  useGetBitcoinAddress,
  useLightningAddress,
  useRegisterLightningAddress,
} from "@/hooks/use-breez";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import { generateRandomUsername } from "@/lib/wallet/username";
import { EditUsernameModal } from "@/components/wallet/edit-username-modal";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import type { LightningAddressInfo } from "@breeztech/breez-sdk-spark";
import { QRCodeSVG } from "qrcode.react";

type PaymentMethod = "lightning" | "bitcoin";

interface ReceivedPaymentDetails {
  id: string;
  amountSat: number;
  feesSat: number;
  timestamp: number;
  method: "lightning" | "spark" | "deposit" | "token";
  status: string;
}

interface BitcoinReceive {
  address: string;
  fee: number;
}

interface InvoiceState {
  paymentRequest: string;
  expiresAt: number;
  fee: number;
  amountSat: number;
  description: string;
}


export default function ReceivePage() {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Receive</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("lightning")}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  paymentMethod === "lightning"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div className="font-medium">Lightning</div>
                <div className="text-xs text-gray-500">Instant</div>
              </button>
              <button
                onClick={() => setPaymentMethod("bitcoin")}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  paymentMethod === "bitcoin"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Bitcoin className="w-6 h-6 text-orange-500" />
                <div className="font-medium">Bitcoin</div>
                <div className="text-xs text-gray-500">Added to your wallet on confirmation</div>
              </button>
            </div>
          </CardContent>
        </Card>

        {paymentMethod === "lightning" ? (
          <LightningPanel onReceived={setReceived} />
        ) : (
          <BitcoinPanel onReceived={setReceived} />
        )}
      </div>
    </div>
  );
}

function LightningPanel({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const { data: lnAddress, isLoading, refetch } = useLightningAddress(true);
  const registerMutation = useRegisterLightningAddress();
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
            e instanceof Error ? e.message : "Couldn't set up Lightning address",
          );
        }
      }
    }
    tryingRef.current = false;
  }, [registerMutation, refetch]);

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
            Setting up your Lightning address…
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
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!lnAddress) return null;

  return (
    <>
      <AddressCard info={lnAddress} onEdit={() => setEditOpen(true)} />
      <InvoiceCreator onReceived={onReceived} />
      <EditUsernameModal
        open={editOpen}
        currentAddress={lnAddress.lightningAddress}
        onClose={() => setEditOpen(false)}
        onChanged={() => {
          setEditOpen(false);
          refetch();
        }}
      />
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
  const [copied, setCopied] = useState(false);

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
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">Your Lightning address</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Share this with anyone who wants to pay you over Lightning.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-lg">
            <QRCodeSVG
              value={info.lightningAddress}
              size={200}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>
        </div>
        <p className="text-center font-mono text-base break-all">
          {info.lightningAddress}
        </p>
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
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit username</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InvoiceCreator({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [invoice, setInvoice] = useState<InvoiceState | null>(null);
  const [error, setError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const receiveMutation = useReceiveLightning();

  useEffect(() => {
    if (!invoice) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.floor((invoice.expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) {
        clearInterval(t);
        setError("Invoice expired. Generate a new one.");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [invoice]);

  useEffect(() => {
    if (!invoice) return;
    const handler = (e: SdkEvent) => {
      if (e.type !== "paymentSucceeded") return;
      const p = e.payment;
      const match =
        p.details?.type === "lightning" &&
        p.details.invoice === invoice.paymentRequest;
      if (!match) return;
      onReceived({
        id: p.id,
        amountSat: Number(p.amount),
        feesSat: Number(p.fees),
        timestamp: p.timestamp,
        method: "lightning",
        status: p.status,
      });
    };
    return onSdkEvent(handler);
  }, [invoice, onReceived]);

  const generate = async () => {
    setError("");
    const amountSat = parseInt(amount, 10);
    if (isNaN(amountSat) || amountSat <= 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      const result = await receiveMutation.mutateAsync({
        amountSat,
        description: description || "Lightning payment",
      });
      setInvoice({
        paymentRequest: result.paymentRequest,
        expiresAt: result.expiresAt,
        fee: result.fee,
        amountSat,
        description,
      });
      setTimeRemaining(3600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate invoice");
    }
  };

  const copy = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice.paymentRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, ignore
    }
  };

  const share = async () => {
    if (!invoice || !navigator.share) return;
    try {
      await navigator.share({
        title: "Lightning invoice",
        text: invoice.paymentRequest,
      });
    } catch {
      // user cancelled or share unavailable
    }
  };

  const reset = () => {
    setInvoice(null);
    setAmount("");
    setDescription("");
    setError("");
    setTimeRemaining(0);
  };

  if (!open) {
    return (
      <div className="text-center">
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Or create a one-time invoice for a specific amount
        </button>
      </div>
    );
  }

  if (invoice) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">One-time invoice</h3>
            {timeRemaining > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/20 px-3 py-1 rounded-full text-xs">
                <Clock className="w-3 h-3 text-amber-700 dark:text-amber-300" />
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  {formatTime(timeRemaining)} left
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center">
            <span className="text-3xl font-bold text-orange-500">
              {invoice.amountSat.toLocaleString()}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">sats</span>
          </p>
          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-lg">
              <QRCodeSVG
                value={invoice.paymentRequest}
                size={200}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg break-all font-mono text-xs">
            {invoice.paymentRequest}
          </div>
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="primary"
              onClick={copy}
              className="inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            {typeof navigator !== "undefined" && typeof navigator.share !== "undefined" ? (
              <Button
                variant="outline"
                onClick={share}
                className="inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </Button>
            ) : (
              <Button variant="outline" onClick={reset}>
                New invoice
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">One-time invoice</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Hide
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label="Amount (sats)"
          placeholder="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
        />
        <Input
          label="Description (optional)"
          placeholder="What is this payment for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={100}
        />
        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={generate}
          loading={receiveMutation.isPending}
          disabled={receiveMutation.isPending || !amount}
          className="w-full"
        >
          Generate invoice
        </Button>
      </CardContent>
    </Card>
  );
}

function BitcoinPanel({
  onReceived,
}: {
  onReceived: (d: ReceivedPaymentDetails) => void;
}) {
  const getMutation = useGetBitcoinAddress();
  const [result, setResult] = useState<BitcoinReceive | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    (async () => {
      try {
        const r = await getMutation.mutateAsync();
        setResult({ address: r.address, fee: r.fee });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate address");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!result) return;
    const handler = (e: SdkEvent) => {
      if (e.type !== "paymentSucceeded") return;
      const p = e.payment;
      if (p.method !== "deposit" && p.method !== "spark") return;
      onReceived({
        id: p.id,
        amountSat: Number(p.amount),
        feesSat: Number(p.fees),
        timestamp: p.timestamp,
        method: p.method === "deposit" ? "deposit" : "spark",
        status: p.status,
      });
    };
    return onSdkEvent(handler);
  }, [result, onReceived]);

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked, ignore
    }
  };

  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generating Bitcoin address…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">One-time Bitcoin address</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pay from any Bitcoin wallet. Funds are added to your wallet
          automatically once confirmed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="p-3 bg-white rounded-lg">
            <QRCodeSVG
              value={result.address}
              size={200}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg break-all font-mono text-xs">
          {result.address}
        </div>
        <Button
          variant="primary"
          onClick={copy}
          className="w-full inline-flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          <span>{copied ? "Copied" : "Copy address"}</span>
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
  const formattedDate = new Date(details.timestamp * 1000).toLocaleString();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-9 h-9 text-green-600 dark:text-green-400" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment received</h2>
            <p className="text-4xl font-bold text-orange-500 mt-4 mb-1">
              {details.amountSat.toLocaleString()} sats
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-6 mb-6 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Method</span>
                <span className="font-medium capitalize">{details.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Fees</span>
                <span className="font-medium">{details.feesSat.toLocaleString()} sats</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Time</span>
                <span className="font-medium text-xs">{formattedDate}</span>
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={onDone} className="w-full">
              Done
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
