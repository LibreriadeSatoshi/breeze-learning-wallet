"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import { useLightningBalance, usePrepareSend, useExecuteSend } from "@/hooks/use-breez";
import type { PrepareSendResult } from "@/lib/lightning/breez-service";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

export default function SendPage() {
  const router = useRouter();
  const isUnlocked = useWalletStore((s) => s.isUnlocked);
  const [step, setStep] = useState<SendStep>("input");
  const [destination, setDestination] = useState("");
  const [amountSatInput, setAmountSatInput] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareSendResult | null>(null);
  const [error, setError] = useState("");

  const { data: balance } = useLightningBalance(true);
  const prepareMutation = usePrepareSend();
  const executeMutation = useExecuteSend();

  const maxPayableMsat = balance?.maxPayableMsat ?? 0;

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
      const amountSat = amountSatInput ? parseInt(amountSatInput, 10) : undefined;
      const prep = await prepareMutation.mutateAsync({ destination: dest, amountSat });
      setPrepareResult(prep);

      const sendAmountSat = readAmountSat(prep);
      if (sendAmountSat !== null && sendAmountSat * 1000 > maxPayableMsat) {
        setError(
          `Insufficient balance. You can send up to ${(maxPayableMsat / 1000).toLocaleString()} sats`,
        );
        return;
      }
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
      await executeMutation.mutateAsync(prepareResult);
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
    const needsAmount = destinationNeedsAmount(destination);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              ←
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

              {needsAmount && (
                <Input
                  label="Amount (sats)"
                  placeholder="0"
                  value={amountSatInput}
                  onChange={(e) => setAmountSatInput(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  helperText="Lightning addresses and zero-amount invoices need an amount"
                />
              )}

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  <span>Paste</span>
                </Button>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handleContinue}
                disabled={!destination || prepareMutation.isPending}
                loading={prepareMutation.isPending}
                className="w-full"
              >
                {prepareMutation.isPending ? "Checking…" : "Continue"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "confirm" && prepareResult) {
    const amountSat = readAmountSat(prepareResult) ?? 0;
    const feesSat = prepareResult.feesSat ?? 0;
    const destLabel = describeDestination(prepareResult);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              ←
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
            disabled={executeMutation.isPending}
            loading={executeMutation.isPending}
            className="w-full"
          >
            {executeMutation.isPending ? "Processing..." : "Confirm & Send Payment"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <div className="animate-spin text-4xl">⚡</div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Sending Payment...</h2>
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
            <span className="text-5xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold mb-3 text-green-600">Payment Sent!</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            {amountSat.toLocaleString()} sats
          </p>
          <Button variant="primary" onClick={() => router.push("/wallet/home")}>
            Back to Wallet
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
            <span className="text-5xl">✕</span>
          </div>
          <h2 className="text-3xl font-bold mb-3 text-red-600">Payment Failed</h2>
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

function readAmountSat(prep: PrepareSendResult): number | null {
  if (!prep.amount) return null;
  if (prep.amount.type === "bitcoin") return prep.amount.receiverAmountSat;
  return null;
}

function describeDestination(prep: PrepareSendResult): string {
  switch (prep.destination.type) {
    case "bolt11":
      return "Lightning invoice";
    case "bolt12":
      return "Lightning offer";
    case "liquidAddress":
      return "Liquid address";
  }
}

// Lightning addresses and zero-amount invoices need an explicit amount.
// Lightning addresses contain `@`; everything else can be detected by the SDK
// after a Prepare call (and a "amount required" error will surface there).
function destinationNeedsAmount(dest: string): boolean {
  return /@/.test(dest.trim());
}
