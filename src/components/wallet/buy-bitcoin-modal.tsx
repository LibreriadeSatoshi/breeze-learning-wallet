"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy as CopyIcon, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyBitcoin, onSdkEvent } from "@/lib/lightning/breez-service";
import { useFiat } from "@/hooks/use-fiat";
import { formatFiat } from "@/lib/wallet/format-fiat";

type Provider = "moonpay" | "cashApp";
type Step = "select" | "amount" | "qr";

const CASH_APP_QUICK_AMOUNTS = [10_000, 50_000, 100_000];
const MIN_CASH_APP_SATS = 1;

interface BuyBitcoinModalProps {
  open: boolean;
  onClose: () => void;
}

export function BuyBitcoinModal({ open, onClose }: BuyBitcoinModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [redirecting, setRedirecting] = useState<Provider | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [cashAppUrl, setCashAppUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { rate: fiatRate, currency: fiatCurrency } = useFiat(open);

  useEffect(() => {
    if (open) return;
    setStep("select");
    setRedirecting(null);
    setAmountInput("");
    setCashAppUrl(null);
    setGenerating(false);
    setError(null);
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== "qr") return;
    return onSdkEvent((event) => {
      if (event.type === "paymentSucceeded") onClose();
    });
  }, [open, step, onClose]);

  const amountSats = useMemo(() => {
    if (!amountInput) return null;
    const n = Number(amountInput);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
    return n;
  }, [amountInput]);

  const validAmount = amountSats !== null && amountSats >= MIN_CASH_APP_SATS;

  const amountFiat =
    fiatRate !== undefined && amountSats !== null && validAmount
      ? formatFiat(amountSats, fiatRate, fiatCurrency)
      : null;

  const handleMoonPay = useCallback(async () => {
    setError(null);
    const tab = window.open("", "_blank");
    setRedirecting("moonpay");
    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/wallet/home`
          : undefined;
      const res = await buyBitcoin({ type: "moonpay", redirectUrl });
      if (tab) tab.location.href = res.url;
      else window.location.href = res.url;
      onClose();
    } catch (e) {
      tab?.close();
      const message = e instanceof Error ? e.message : "Failed to open MoonPay";
      setError(message);
    } finally {
      setRedirecting(null);
    }
  }, [onClose]);

  const isCoarsePointer = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const handleGenerateCashApp = useCallback(async () => {
    if (!validAmount || amountSats === null) {
      setError(`Amount must be at least ${MIN_CASH_APP_SATS} sats`);
      return;
    }
    setError(null);
    setGenerating(true);
    const mobile = isCoarsePointer();
    const tab = mobile ? window.open("", "_blank") : null;
    try {
      const res = await buyBitcoin({ type: "cashApp", amountSats });
      if (mobile) {
        if (tab) tab.location.href = res.url;
        else window.location.href = res.url;
        onClose();
      } else {
        setCashAppUrl(res.url);
        setStep("qr");
      }
    } catch (e) {
      tab?.close();
      const message =
        e instanceof Error ? e.message : "Failed to create Cash App invoice";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [validAmount, amountSats, onClose]);

  const handleCopy = useCallback(async () => {
    if (!cashAppUrl) return;
    try {
      await navigator.clipboard.writeText(cashAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked, ignore
    }
  }, [cashAppUrl]);

  const title =
    step === "select"
      ? "Buy Bitcoin"
      : step === "amount"
        ? "Buy with Cash App"
        : "Pay with Cash App";

  return (
    <Modal open={open} onClose={onClose} title={title} dismissable={!generating && !redirecting}>
      {step === "select" && (
        <div className="space-y-3">
          <button
            onClick={handleMoonPay}
            disabled={redirecting !== null}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-left disabled:opacity-50"
          >
            <ProviderBadge provider="moonpay" />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {redirecting === "moonpay" ? "Redirecting…" : "MoonPay"}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Card, Apple/Google Pay, bank transfer
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setStep("amount")}
            disabled={redirecting !== null}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-all text-left disabled:opacity-50"
          >
            <ProviderBadge provider="cashApp" />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                Cash App
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                US/UK only · pays a Lightning invoice
              </div>
            </div>
          </button>
        </div>
      )}

      {step === "amount" && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("select")} disabled={generating} />
          <div>
            <Input
              type="number"
              inputMode="numeric"
              label="Amount (sats)"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setError(null);
              }}
              placeholder="Enter amount in satoshis"
              disabled={generating}
              autoFocus
              min={1}
            />
            {amountFiat && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ≈ {amountFiat}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {CASH_APP_QUICK_AMOUNTS.map((sats) => (
              <button
                key={sats}
                type="button"
                onClick={() => {
                  setAmountInput(String(sats));
                  setError(null);
                }}
                disabled={generating}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  amountInput === String(sats)
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {sats.toLocaleString()}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cash App will show the equivalent in your local currency and charge
            your Cash or BTC balance.
          </p>
          {error && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleGenerateCashApp}
            loading={generating}
            disabled={!validAmount || generating}
            className="w-full"
          >
            Continue
          </Button>
        </div>
      )}

      {step === "qr" && cashAppUrl && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("amount")} />
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Scan this code with Cash App, or open the link on a device with Cash
            App installed.
          </p>
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={cashAppUrl} size={220} level="M" />
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <CopyIcon className="w-4 h-4" />
            )}
            <span>{copied ? "Copied" : "Copy Cash App link"}</span>
          </button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            This dialog will refresh automatically once the payment lands.
          </p>
        </div>
      )}
    </Modal>
  );
}

function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}

function ProviderBadge({ provider }: { provider: Provider }) {
  if (provider === "moonpay") {
    return (
      <div className="w-10 h-10 rounded-lg bg-[#7B36D9] text-white flex items-center justify-center font-bold text-sm shrink-0">
        M
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-[#00D64F] text-white flex items-center justify-center font-bold text-sm shrink-0">
      $
    </div>
  );
}
