"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy as CopyIcon, NavArrowRight, OpenNewWindow } from "iconoir-react";
import { QRCodeSVG } from "qrcode.react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { buyBitcoin, onSdkEvent } from "@/lib/lightning/breez-service";
import { useFiat } from "@/hooks/use-fiat";
import { convertSatsToFiat } from "@/lib/wallet/format-fiat";
import { useT } from "@/lib/i18n/hook";
import { useCopy } from "@/hooks/use-copy";

type Provider = "moonpay" | "cashApp";
type Step = "select" | "amount" | "qr";

const providerRowClass =
  "flex w-full items-center gap-4 rounded border border-hairline p-4 text-left text-fg transition-colors duration-fast hover:border-strong disabled:text-logwood-600";

const CASH_APP_QUICK_AMOUNTS = [10_000, 50_000, 100_000];
const MIN_CASH_APP_SATS = 1;

interface BuyBitcoinModalProps {
  onClose: () => void;
}

export function BuyBitcoinModal({ onClose }: BuyBitcoinModalProps) {
  const t = useT();
  const [step, setStep] = useState<Step>("select");
  const [redirecting, setRedirecting] = useState<Provider | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [cashAppUrl, setCashAppUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copied, failed, copy } = useCopy();

  const { rate: fiatRate, currency: fiatCurrency } = useFiat(true);

  useEffect(() => {
    if (step !== "qr") return;
    return onSdkEvent((event) => {
      if (event.type === "paymentSucceeded") onClose();
    });
  }, [step, onClose]);

  const amountSats = useMemo(() => {
    if (!amountInput) return null;
    const n = Number(amountInput);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
    return n;
  }, [amountInput]);

  const validAmount = amountSats !== null && amountSats >= MIN_CASH_APP_SATS;

  const amountFiat =
    fiatRate !== undefined && amountSats !== null && validAmount
      ? convertSatsToFiat({sats: amountSats, ratePerBtc: fiatRate, currency: fiatCurrency})
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
      const message = e instanceof Error ? e.message : t("buyBitcoin.moonpayFailed");
      setError(message);
    } finally {
      setRedirecting(null);
    }
  }, [onClose, t]);

  const isCoarsePointer = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const handleGenerateCashApp = useCallback(async () => {
    if (!validAmount || amountSats === null) {
      setError(t("buyBitcoin.amountTooLow", { min: MIN_CASH_APP_SATS }));
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
        e instanceof Error ? e.message : t("buyBitcoin.cashAppFailed");
      setError(message);
    } finally {
      setGenerating(false);
    }
  }, [validAmount, amountSats, onClose, t]);

  const title =
    step === "select"
      ? t("buyBitcoin.select")
      : step === "amount"
        ? t("buyBitcoin.amount")
        : t("buyBitcoin.qr");

  return (
    <Modal open onClose={onClose} title={title} dismissable={!generating && !redirecting}>
      {step === "select" && (
        <div className="space-y-3">
          <button type="button"
            onClick={handleMoonPay}
            disabled={redirecting !== null}
            className={providerRowClass}
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold">
                {redirecting === "moonpay" ? t("buyBitcoin.moonpayRedirecting") : "MoonPay"}
              </div>
              <div className="text-body-sm text-fg-muted">
                {t("buyBitcoin.moonpaySubtitle")}
              </div>
            </div>
            <OpenNewWindow aria-hidden="true" className="h-5 w-5 flex-none text-fg-muted" />
          </button>
          <button type="button"
            onClick={() => setStep("amount")}
            disabled={redirecting !== null}
            className={providerRowClass}
          >
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold">
                Cash App
              </div>
              <div className="text-body-sm text-fg-muted">
                {t("buyBitcoin.cashAppSubtitle")}
              </div>
            </div>
            <NavArrowRight aria-hidden="true" className="h-5 w-5 flex-none text-fg-muted" />
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
              label={t("buyBitcoin.amountLabel")}
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setError(null);
              }}
              placeholder={t("buyBitcoin.amountPlaceholder")}
              disabled={generating}
              autoFocus
              min={1}
            />
            {amountFiat && (
              <div className="mt-2 font-mono text-caption tabular-nums text-fg-muted">
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
                aria-pressed={amountInput === String(sats)}
                className={`min-h-control flex-1 rounded border-2 font-mono text-body-sm tabular-nums transition-colors duration-fast disabled:border-hairline disabled:text-logwood-600 ${
                  amountInput === String(sats)
                    ? "border-strong font-semibold text-fg"
                    : "border-hairline text-fg-muted hover:border-strong hover:text-fg"
                }`}
              >
                {sats.toLocaleString()}
              </button>
            ))}
          </div>
          <p className="text-body-sm text-fg-muted">
            {t("buyBitcoin.cashAppInfo")}
          </p>
          {error && (
            <StatusNote status="error">{error}</StatusNote>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={handleGenerateCashApp}
            loading={generating}
            disabled={!validAmount || generating}
            className="w-full"
          >
            {t("common.continue")}
          </Button>
        </div>
      )}

      {step === "qr" && cashAppUrl && (
        <div className="space-y-4">
          <BackButton onClick={() => setStep("amount")} />
          <p className="text-center text-body-sm text-fg-muted">
            {t("buyBitcoin.qrInstructions")}
          </p>
          <div className="flex justify-center">
            <div className="rounded border border-hairline bg-paper p-4">
              <QRCodeSVG aria-label={t("buyBitcoin.cashAppQrAriaLabel")} value={cashAppUrl} size={220} level="M" />
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => cashAppUrl && copy(cashAppUrl)}
            className="w-full"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-5 w-5" />
            ) : (
              <CopyIcon aria-hidden="true" className="h-5 w-5" />
            )}
            <span>{copied ? t("common.copied") : failed ? t("common.copyFailed") : t("buyBitcoin.copyLink")}</span>
          </Button>
          <p className="text-center text-caption text-fg-muted">
            {t("buyBitcoin.autoRefresh")}
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
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-ml-2 inline-flex min-h-control items-center gap-2 rounded px-2 text-body-sm text-fg-muted transition-colors duration-fast hover:text-fg disabled:text-logwood-600"
    >
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      {t("common.back")}
    </button>
  );
}
