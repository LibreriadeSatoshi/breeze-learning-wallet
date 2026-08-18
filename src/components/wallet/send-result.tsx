"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/hook";

function ResultScreen({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center px-6">{children}</div>
    </div>
  );
}

export function SendProcessing() {
  const t = useT();
  return (
    <ResultScreen>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
      <h2 className="text-2xl font-bold mb-2">{t("send.sendingPayment")}</h2>
    </ResultScreen>
  );
}

export function SendSuccess({
  amountSat,
  onDone,
}: {
  readonly amountSat: number;
  readonly onDone: () => void;
}) {
  const t = useT();
  return (
    <ResultScreen>
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
        <Check className="w-10 h-10 text-green-600 dark:text-green-400" strokeWidth={3} />
      </div>
      <h2 className="text-3xl font-bold mb-3 text-green-600">{t("send.sent")}</h2>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
        {amountSat.toLocaleString()} {t("send.sats")}
      </p>
      <Button variant="primary" onClick={onDone}>
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
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <X className="w-10 h-10 text-red-600 dark:text-red-400" strokeWidth={3} />
      </div>
      <h2 className="text-3xl font-bold mb-3 text-red-600">{t("send.failed")}</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {message || t("send.genericError")}
      </p>
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button variant="primary" onClick={onRetry}>
          {t("send.tryAgain")}
        </Button>
      </div>
    </ResultScreen>
  );
}
