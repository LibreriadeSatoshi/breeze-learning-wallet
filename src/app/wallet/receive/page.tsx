"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bitcoin,
  Check,
  Clock,
  Copy as CopyIcon,
  Share2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useReceiveLightning,
  useGetBitcoinAddress,
} from "@/hooks/use-breez";
import { onSdkEvent } from "@/lib/lightning/breez-service";
import type { SdkEvent } from "@/lib/lightning/sdk-events";
import { QRCodeSVG } from "qrcode.react";

type ReceiveStep = "input" | "display" | "success";
type PaymentMethod = "lightning" | "bitcoin";

interface PaymentInfo {
  paymentRequest: string;
  expiresAt?: number;
  fee?: number;
}

interface ReceivedPaymentDetails {
  id: string;
  amountSat: number;
  feesSat: number;
  timestamp: number;
  method: "lightning" | "spark" | "deposit" | "token";
  status: string;
}

export default function ReceivePage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);

  const [step, setStep] = useState<ReceiveStep>("input");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("lightning");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [, setPaymentReceived] = useState(false);
  const [receivedPaymentDetails, setReceivedPaymentDetails] =
    useState<ReceivedPaymentDetails | null>(null);

  const receiveMutation = useReceiveLightning();
  const getBitcoinAddressMutation = useGetBitcoinAddress();

  useEffect(() => {
    if (!isUnlocked) {
      router.push("/welcome");
    }
  }, [isUnlocked, router]);

  useEffect(() => {
    if (step !== "display" || !paymentInfo) return;

    const handleEvent = (event: SdkEvent) => {
      if (event.type !== "paymentSucceeded") return;

      const payment = event.payment;
      const ourDestination = paymentInfo.paymentRequest;

      const matchesLightning =
        paymentMethod === "lightning" &&
        payment.details?.type === "lightning" &&
        payment.details.invoice === ourDestination;

      // On-chain Bitcoin receives arrive as either "deposit" (waiting
      // to claim) or a completed deposit/spark conversion. We accept the
      // payment as soon as any related event fires once we're displaying
      // a Bitcoin address.
      const matchesBitcoin =
        paymentMethod === "bitcoin" &&
        (payment.details?.type === "deposit" ||
          payment.method === "deposit" ||
          payment.method === "spark");

      if (!matchesLightning && !matchesBitcoin) return;

      const method = payment.method === "deposit"
        ? "deposit"
        : payment.method === "spark"
          ? "spark"
          : payment.method === "token"
            ? "token"
            : "lightning";

      setReceivedPaymentDetails({
        id: payment.id,
        amountSat: Number(payment.amount),
        feesSat: Number(payment.fees),
        timestamp: payment.timestamp,
        method,
        status: payment.status,
      });
      setPaymentReceived(true);
      setStep("success");
    };

    const unsubscribe = onSdkEvent(handleEvent);
    return () => unsubscribe();
  }, [step, paymentInfo, paymentMethod]);

  useEffect(() => {
    if (
      paymentInfo?.expiresAt &&
      step === "display" &&
      paymentMethod === "lightning"
    ) {
      const interval = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.floor((paymentInfo.expiresAt! - Date.now()) / 1000)
        );
        setTimeRemaining(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          setError("Invoice expired. Please create a new one.");
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [paymentInfo, step, paymentMethod]);

  const handleAmountChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setAmount(sanitized);
    setError("");
  };

  const handleContinue = async () => {
    setError("");

    try {
      if (paymentMethod === "lightning") {
        const amountSat = parseInt(amount, 10);
        if (isNaN(amountSat) || amountSat <= 0) {
          setError("Please enter a valid amount");
          return;
        }
        const result = await receiveMutation.mutateAsync({
          amountSat,
          description: description || "Lightning payment",
        });
        setPaymentInfo({
          paymentRequest: result.paymentRequest,
          expiresAt: result.expiresAt,
          fee: result.fee,
        });
        setTimeRemaining(3600);
        setStep("display");
      } else {
        const result = await getBitcoinAddressMutation.mutateAsync();
        setPaymentInfo({
          paymentRequest: result.address,
          fee: result.fee,
        });
        setStep("display");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate invoice";
      setError(message);
    }
  };

  const handleCopy = async () => {
    if (paymentInfo?.paymentRequest) {
      try {
        await navigator.clipboard.writeText(paymentInfo.paymentRequest);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Failed to copy to clipboard");
      }
    }
  };

  const handleShare = async () => {
    if (paymentInfo?.paymentRequest && navigator.share) {
      try {
        await navigator.share({
          title:
            paymentMethod === "lightning"
              ? "Lightning Invoice"
              : "Bitcoin Address",
          text: paymentInfo.paymentRequest,
        });
      } catch {
        // user cancelled or share unavailable
      }
    }
  };

  const handleNew = () => {
    setStep("input");
    setAmount("");
    setDescription("");
    setPaymentInfo(null);
    setError("");
    setCopied(false);
    setTimeRemaining(0);
    setPaymentReceived(false);
    setReceivedPaymentDetails(null);
  };

  const handleDone = () => {
    router.push("/wallet/home");
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isUnlocked) {
    return null;
  }

  if (step === "input") {
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
            <h1 className="text-2xl font-bold">Receive Payment</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Payment Method</h2>
            </CardHeader>
            <CardContent>
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
                  <div className="text-xs text-gray-500">On-chain</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {paymentMethod === "lightning" && (
            <Card className="mb-6">
              <CardHeader>
                <h2 className="text-lg font-semibold">Enter Amount</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Input
                    label="Amount (sats)"
                    placeholder="1000"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    error={error}
                  />
                </div>

                <Input
                  label="Description (optional)"
                  placeholder="What is this payment for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={100}
                />
              </CardContent>
            </Card>
          )}

          {paymentMethod === "bitcoin" && (
            <Card className="mb-6">
              <CardContent className="pt-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Bitcoin address (one-time deposit)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generates a fresh Bitcoin address. Funds sent to it are
                  claimed onto Spark automatically. Use a new address for
                  each payment.
                </p>
              </CardContent>
            </Card>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            disabled={
              (paymentMethod === "lightning" && !amount) ||
              receiveMutation.isPending ||
              getBitcoinAddressMutation.isPending
            }
            loading={
              receiveMutation.isPending ||
              getBitcoinAddressMutation.isPending
            }
            className="w-full mb-6"
          >
            {receiveMutation.isPending || getBitcoinAddressMutation.isPending
              ? "Preparing..."
              : paymentMethod === "lightning"
                ? "Generate invoice"
                : "Show Bitcoin address"}
          </Button>

          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Tip:</strong>{" "}
              {paymentMethod === "lightning"
                ? "Lightning invoices expire after 1 hour. Make sure the sender pays before then."
                : "Each Bitcoin address is single-use. Generate a new one for each payment."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "display") {
    const amountSats = parseInt(amount, 10) || 0;
    const canShare = typeof navigator.share !== "undefined";
    const isLightning = paymentMethod === "lightning";

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={handleNew}
                aria-label="Back"
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold">
                {isLightning ? "Lightning Invoice" : "Bitcoin Address"}
              </h1>
            </div>
            {isLightning && timeRemaining > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/20 px-3 py-1.5 rounded-full text-sm">
                <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  {formatTime(timeRemaining)} left
                </span>
              </div>
            )}
          </div>

          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <div className="flex items-center gap-3">
              <div className="animate-pulse">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-200">
                  Waiting for payment...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {isLightning
                    ? "The page will update automatically when payment is received"
                    : "Bitcoin payments may take a few minutes to appear"}
                </p>
              </div>
            </div>
          </div>

          {isLightning && amountSats > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-8 pb-8">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Request for
                  </p>
                  <p className="text-5xl font-bold text-orange-500 mb-2">
                    {amountSats.toLocaleString()}
                  </p>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    sats
                  </p>
                  {description && (
                    <p className="text-sm text-gray-500 mt-3 italic">
                      &ldquo;{description}&rdquo;
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!isLightning && (
            <Card className="mb-6">
              <CardContent className="pt-6 pb-6 text-center">
                <h3 className="text-lg font-semibold mb-2">
                  One-time Bitcoin address
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pay this address from any Bitcoin wallet. The funds will be
                  swapped to Liquid and claimed automatically. Generate a new
                  address for the next payment.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                {paymentInfo?.paymentRequest ? (
                  <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG
                      value={paymentInfo.paymentRequest}
                      size={256}
                      level="M"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500">Loading QR code...</p>
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 text-center">
                  Scan this QR code with a{" "}
                  {isLightning ? "Lightning" : "Bitcoin"} wallet
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                {isLightning ? "Invoice" : "Address"}
              </h3>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg break-all font-mono text-sm mb-4">
                {paymentInfo?.paymentRequest}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
                {canShare && (
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="mt-6">
            <Button variant="outline" onClick={handleNew} className="w-full">
              Create New {isLightning ? "Invoice" : "Request"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (step === "success") {
    const receivedAmount = receivedPaymentDetails?.amountSat ?? parseInt(amount, 10) ?? 0;
    const receivedFees = receivedPaymentDetails?.feesSat ?? 0;

    const formattedDate = receivedPaymentDetails?.timestamp
      ? new Date(receivedPaymentDetails.timestamp * 1000).toLocaleString()
      : new Date().toLocaleString();

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Card className="mb-6">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-9 h-9 text-green-600 dark:text-green-400" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Payment received</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {paymentMethod === "lightning"
                  ? "Successfully received via Lightning"
                  : "Bitcoin payment received and claimed"}
              </p>

              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-6 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Amount Received
                </p>
                <p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {receivedAmount.toLocaleString()} sats
                </p>
              </div>

              {receivedPaymentDetails && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Payment ID
                    </span>
                    <span className="font-mono text-xs">
                      {receivedPaymentDetails.id.slice(0, 20)}...
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Method
                    </span>
                    <span className="font-medium capitalize">
                      {receivedPaymentDetails.method}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Fees
                    </span>
                    <span className="font-medium">{receivedFees} sats</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Status
                    </span>
                    <span className="font-medium capitalize text-green-600 dark:text-green-400">
                      {receivedPaymentDetails.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Time
                    </span>
                    <span className="font-medium text-xs">{formattedDate}</span>
                  </div>
                </div>
              )}

              {!receivedPaymentDetails && paymentInfo && (
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Payment Request
                  </p>
                  <p className="font-mono text-xs break-all">
                    {paymentInfo.paymentRequest.slice(0, 50)}...
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleDone}
                  className="w-full"
                >
                  Done
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleNew}
                  className="w-full"
                >
                  Receive Another Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
