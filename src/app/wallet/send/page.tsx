"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Clipboard, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import {
  useLightningBalance,
  useLightningLimits,
  useParseInput,
  usePrepareSend,
  useExecuteSend,
  usePrepareLnurlPay,
  useExecuteLnurlPay,
} from "@/hooks/use-breez";
import type {
  PrepareSendResult,
  PrepareLnurlPayResult,
} from "@/lib/lightning/breez-service";
import type { InputType } from "@breeztech/breez-sdk-liquid";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

type PrepareResult =
  | { kind: "send"; data: PrepareSendResult }
  | { kind: "lnurlPay"; data: PrepareLnurlPayResult };

export default function SendPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [amountSatInput, setAmountSatInput] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [error, setError] = useState("");

  const { data: balance } = useLightningBalance(true);
  const { data: limits } = useLightningLimits(true);
  const parseMutation = useParseInput();
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();
  const prepareLnurlMutation = usePrepareLnurlPay();
  const executeLnurlMutation = useExecuteLnurlPay();

  const maxPayableMsat = balance?.maxPayableMsat ?? 0;
  const sendMin = limits?.send.minSat;
  const sendMax = limits?.send.maxSat;

  useEffect(() => {
    if (!isUnlocked) {
      router.push("/welcome");
    }
  }, [isUnlocked, router]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDestination(text.trim());
        setError("");
      }
    } catch {
      setError("Failed to access clipboard");
    }
  };

  const handleContinue = async () => {
    setError("");
    const dest = destination.trim();
    if (!dest) {
      setError("Enter a destination");
      return;
    }
    try {
      // Parse first so we can route LNURL-pay through the right SDK call
      // and give clean errors for input types we can't pay.
      const parsed = await parseMutation.mutateAsync(dest);
      const unsupported = describeUnsupported(parsed);
      if (unsupported) {
        setError(unsupported);
        return;
      }

      const amountSat = amountSatInput ? parseInt(amountSatInput, 10) : undefined;

      let prep: PrepareResult;
      if (parsed.type === "lnUrlPay") {
        if (!amountSat || amountSat <= 0) {
          setError("Enter an amount to send to this Lightning address");
          return;
        }
        const minSat = Math.ceil(parsed.data.minSendable / 1000);
        const maxSat = Math.floor(parsed.data.maxSendable / 1000);
        if (amountSat < minSat || amountSat > maxSat) {
          setError(
            `This Lightning address accepts ${minSat.toLocaleString()}–${maxSat.toLocaleString()} sats`,
          );
          return;
        }
        const lnurlPrep = await prepareLnurlMutation.mutateAsync({
          data: parsed.data,
          amountSat,
        });
        prep = { kind: "lnurlPay", data: lnurlPrep };
      } else {
        const sendPrep = await prepareMutation.mutateAsync({ destination: dest, amountSat });
        prep = { kind: "send", data: sendPrep };
      }

      const sendAmountSat = readAmountSat(prep);
      if (sendAmountSat !== null && sendAmountSat * 1000 > maxPayableMsat) {
        setError(
          `Insufficient balance. You can send up to ${(maxPayableMsat / 1000).toLocaleString()} sats`,
        );
        return;
      }
      setPrepareResult(prep);
      setStep("confirm");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not parse destination";
      setError(msg);
    }
  };

  const handleConfirmPayment = async () => {
    if (!prepareResult) return;
    setStep("processing");
    setError("");
    try {
      if (prepareResult.kind === "send") {
        await executeMutation.mutateAsync(prepareResult.data);
      } else {
        const result = await executeLnurlMutation.mutateAsync(prepareResult.data);
        if (result.type === "endpointError") {
          throw new Error(
            result.data.reason || "The Lightning address endpoint returned an error.",
          );
        }
        if (result.type === "payError") {
          throw new Error(result.data.reason || "Payment to Lightning address failed.");
        }
      }
      setStep("success");
      setTimeout(() => router.push("/wallet/home"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setStep("error");
    }
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("input");
    } else {
      router.back();
    }
  };

  const handleRetry = () => {
    setStep("input");
    setError("");
    setDestination("");
    setAmountSatInput("");
    setPrepareResult(null);
  };

  if (!isUnlocked) return null;

  if (step === "input") {
    const limitsHelp =
      sendMin !== undefined && sendMax !== undefined
        ? `Min ${sendMin.toLocaleString()} sats · Max ${sendMax.toLocaleString()} sats (Lightning)`
        : "Optional for BOLT11 invoices that already encode an amount";

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Send Payment</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Available to Send
                </p>
                <p className="text-3xl font-bold text-orange-500">
                  {(maxPayableMsat / 1000).toLocaleString()} sats
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Destination</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="BOLT11 invoice, Lightning address, or Liquid address"
                placeholder="lnbc... | alice@example.com | lq1..."
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setError("");
                }}
                error={error || undefined}
                helperText="The wallet will figure out the payment type"
              />

              <Input
                label="Amount (sats)"
                placeholder="0"
                value={amountSatInput}
                onChange={(e) => setAmountSatInput(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                helperText={limitsHelp}
              />

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Clipboard className="w-4 h-4" />
                  Paste from clipboard
                </Button>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleContinue}
                disabled={
                  !destination ||
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                loading={
                  prepareMutation.isPending ||
                  prepareLnurlMutation.isPending ||
                  parseMutation.isPending
                }
                className="w-full"
              >
                {prepareMutation.isPending ||
                prepareLnurlMutation.isPending ||
                parseMutation.isPending
                  ? "Checking…"
                  : "Continue"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "confirm" && prepareResult) {
    const amountSat = readAmountSat(prepareResult) ?? 0;
    const feesSat = prepareResult.data.feesSat ?? 0;
    const destLabel = describeDestination(prepareResult);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Confirm Payment</h1>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-8 pb-8">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  You&apos;re sending
                </p>
                <p className="text-5xl font-bold text-orange-500 mb-2">
                  {amountSat.toLocaleString()}
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-400">sats</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Payment Details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Type</span>
                <span className="font-medium capitalize">{destLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Network Fee</span>
                <span className="font-medium">{feesSat.toLocaleString()} sats</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-orange-500">
                  {(amountSat + feesSat).toLocaleString()} sats
                </span>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
              <p className="text-sm text-red-900 dark:text-red-200">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={handleConfirmPayment}
            disabled={executeMutation.isPending || executeLnurlMutation.isPending}
            loading={executeMutation.isPending || executeLnurlMutation.isPending}
            className="w-full"
          >
            {executeMutation.isPending || executeLnurlMutation.isPending
              ? "Processing..."
              : "Confirm & Send Payment"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold mb-2">Sending payment…</h2>
        </div>
      </div>
    );
  }

  if (step === "success") {
    const amountSat = prepareResult ? readAmountSat(prepareResult) ?? 0 : 0;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-green-600">Payment sent</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            {amountSat.toLocaleString()} sats
          </p>
          <Button variant="primary" onClick={() => router.push("/wallet/home")}>
            Back to wallet
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <X className="w-10 h-10 text-red-600 dark:text-red-400" strokeWidth={3} />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-red-600">Payment failed</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            {error || "Something went wrong. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/wallet/home")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRetry}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function readAmountSat(prep: PrepareResult): number | null {
  if (prep.kind === "lnurlPay") {
    if (prep.data.amount.type === "bitcoin") return prep.data.amount.receiverAmountSat;
    return null;
  }
  if (!prep.data.amount) return null;
  if (prep.data.amount.type === "bitcoin") return prep.data.amount.receiverAmountSat;
  return null;
}

function describeDestination(prep: PrepareResult): string {
  if (prep.kind === "lnurlPay") {
    return `Lightning address (${prep.data.data.domain})`;
  }
  switch (prep.data.destination.type) {
    case "bolt11":
      return "Lightning invoice";
    case "bolt12":
      return "Lightning offer";
    case "liquidAddress":
      return "Liquid address";
  }
}

// Surface a clean error for input types the wallet can't pay. The SDK's
// parse() recognises these, but prepareSendPayment would still error
// later — this gives the user a useful message up front instead of a
// generic "destination not valid".
function describeUnsupported(parsed: InputType): string | null {
  switch (parsed.type) {
    case "lnUrlAuth":
      return "LNURL-auth is for logging in, not paying. Use it elsewhere.";
    case "lnUrlWithdraw":
      return "LNURL-withdraw is for receiving, not sending.";
    case "lnUrlError":
      return parsed.data.reason || "The LNURL endpoint returned an error.";
    case "url":
      return "That looks like a web link, not a payment destination.";
    case "nodeId":
      return "Bare node IDs aren't payable — use a BOLT11 invoice instead.";
    case "nostrWalletConnectUri":
      return "Nostr Wallet Connect isn't supported in this wallet.";
    default:
      return null;
  }
}
