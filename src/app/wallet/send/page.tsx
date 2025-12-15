"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store/wallet-store";
import { useLightningBalance, useSendPayment } from "@/hooks/use-breez";
import { parseInvoice, validateInvoice } from "@/lib/lightning/invoice-utils";

type SendStep = "input" | "confirm" | "processing" | "success" | "error";

interface InvoiceData {
  amountMsat?: number;
  description?: string;
  payee?: string;
  timestamp?: number;
  expiry?: number;
}

export default function SendPage() {
  const router = useRouter();
  const { isInitialized } = useWalletStore();
  const [step, setStep] = useState<SendStep>("input");
  const [invoice, setInvoice] = useState("");
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");

  const { data: balance } = useLightningBalance(true);
  const sendPaymentMutation = useSendPayment();

  const maxPayableMsat = balance?.maxPayableMsat ?? 0;

  useEffect(() => {
    if (!isInitialized) {
      router.push("/welcome");
    }
  }, [isInitialized, router]);

  const handleInvoiceChange = (value: string) => {
    setInvoice(value);
    setError("");

    if (value.length > 10) {
      const parsed = parseInvoice(value);
      if (parsed) {
        setInvoiceData(parsed);
      }
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleInvoiceChange(text);
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      setError("Failed to access clipboard");
    }
  };

  const handleScan = () => {
    setError("QR code scanning coming soon!");
  };

  const handleContinue = () => {
    setError("");

    const validation = validateInvoice(invoice);
    if (!validation.valid) {
      setError(validation.error || "Invalid invoice");
      return;
    }

    const parsed = parseInvoice(invoice);
    if (!parsed) {
      setError("Failed to parse invoice");
      return;
    }

    setInvoiceData(parsed);

    if (parsed.amountMsat && parsed.amountMsat > 0) {
      if (parsed.amountMsat > maxPayableMsat) {
        setError(
          `Insufficient balance. You can send up to ${(
            maxPayableMsat / 1000
          ).toLocaleString()} sats`
        );
        return;
      }
      setStep("confirm");
    } else {
      setError("Zero-amount invoices are not yet supported");
      return;
    }
  };

  const handleConfirmPayment = async () => {
    setStep("processing");
    setError("");

    try {
      await sendPaymentMutation.mutateAsync(invoice);
      setStep("success");

      setTimeout(() => {
        router.push("/wallet/home");
      }, 2000);
    } catch (err: any) {
      console.error("Payment failed:", err);
      setError(err.message || "Payment failed. Please try again.");
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
    setInvoice("");
    setInvoiceData(null);
  };

  if (!isInitialized) return null;

  if (step === "input") {
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
                <p className="text-sm text-gray-500 mt-1">
                  ≈ ${((maxPayableMsat / 1000) * 0.0004).toFixed(2)} USD
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Enter Lightning Invoice</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Lightning Invoice"
                placeholder="lnbc..."
                value={invoice}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                error={error}
                helperText="Paste a Lightning invoice (BOLT11)"
              />

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={handlePaste}
                  className="flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  <span>Paste</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleScan}
                  className="flex items-center justify-center gap-2"
                >
                  <span>📷</span>
                  <span>Scan QR</span>
                </Button>
              </div>

              {invoiceData && !error && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                    Invoice Details
                  </p>
                  {invoiceData.amountMsat && invoiceData.amountMsat > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-blue-700 dark:text-blue-300">
                        Amount:
                      </span>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {(invoiceData.amountMsat / 1000).toLocaleString()} sats
                      </span>
                    </div>
                  )}
                  {invoiceData.description && (
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700 dark:text-blue-300">
                        Description:
                      </span>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {invoiceData.description}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleContinue}
                disabled={!invoice || invoice.length < 10}
                className="w-full"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const amountSats = invoiceData?.amountMsat
      ? invoiceData.amountMsat / 1000
      : 0;
    const amountUsd = (amountSats * 0.0004).toFixed(2);

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
                  {amountSats.toLocaleString()}
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-400">sats</p>
                <p className="text-sm text-gray-500 mt-2">≈ ${amountUsd} USD</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">Payment Details</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoiceData?.description && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Description
                  </span>
                  <span className="font-medium">{invoiceData.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Network Fee
                </span>
                <span className="font-medium text-green-600">Included</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-orange-500">
                  {amountSats.toLocaleString()} sats
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
            disabled={sendPaymentMutation.isPending}
            loading={sendPaymentMutation.isPending}
            className="w-full"
          >
            {sendPaymentMutation.isPending
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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
            <div className="animate-spin text-4xl">⚡</div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Sending Payment...</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we process your Lightning payment
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <span className="text-5xl">✓</span>
          </div>
          <h2 className="text-3xl font-bold mb-3 text-green-600">
            Payment Sent!
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            {invoiceData?.amountMsat
              ? (invoiceData.amountMsat / 1000).toLocaleString()
              : 0}{" "}
            sats
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Your Lightning payment was successful
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
          <h2 className="text-3xl font-bold mb-3 text-red-600">
            Payment Failed
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            {error || "Something went wrong. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => router.push("/wallet/home")}
            >
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
