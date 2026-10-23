"use client";

import { Button } from "@/components/ui/button";
import { StatusNote } from "@/components/ui/status-note";
import { useT } from "@/lib/i18n/hook";

function ResultScreen({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function SendProcessing() {
  const t = useT();
  return (
    <ResultScreen>
      <div className="text-center">
        <div
          aria-hidden="true"
          className="h-12 w-12 mx-auto mb-6 rounded-full border-2 border-track border-t-strong animate-spin"
        />
        <h2 className="font-serif text-h2 text-heading">{t("send.sendingPayment")}</h2>
      </div>
    </ResultScreen>
  );
}

export function SendSuccess({
  amountSat,
  pending = false,
  onDone,
}: {
  readonly amountSat: number;
  readonly pending?: boolean;
  readonly onDone: () => void;
}) {
  const t = useT();
  return (
    <ResultScreen>
      <StatusNote status={pending ? "info" : "success"} className="mb-6">
        <h2 className="font-serif text-h2 text-heading">
          {pending ? t("send.pendingTitle") : t("send.sent")}
        </h2>
        <p className="mt-2 font-mono text-h3 tabular-nums text-fg">
          {amountSat.toLocaleString()} {t("send.sats")}
        </p>
        {pending && <p className="mt-2 text-body-sm text-fg">{t("send.pendingBody")}</p>}
      </StatusNote>
      <Button variant="primary" size="lg" onClick={onDone} className="w-full">
        {t("send.backToWallet")}
      </Button>
    </ResultScreen>
  );
}

export function SendError({
  message,
  onRetry,
  onCancel,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly onCancel: () => void;
}) {
  const t = useT();
  return (
    <ResultScreen>
      <StatusNote status="error" className="mb-6">
        <h2 className="font-serif text-h2 text-heading">{t("send.failed")}</h2>
        <p className="mt-2 text-body text-fg">{message || t("send.genericError")}</p>
      </StatusNote>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" size="lg" onClick={onRetry}>
          {t("send.tryAgain")}
        </Button>
      </div>
    </ResultScreen>
  );
}
