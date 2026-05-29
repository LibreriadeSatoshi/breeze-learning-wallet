"use client";

import { useState } from "react";
import type { Payment } from "@/lib/lightning/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface PaymentDetailModalProps {
  payment: Payment | null;
  onClose: () => void;
}

export function PaymentDetailModal({ payment, onClose }: PaymentDetailModalProps) {
  return (
    <Modal open={payment !== null} onClose={onClose} title="Payment details">
      {payment && <PaymentDetailContent payment={payment} onClose={onClose} />}
    </Modal>
  );
}

function PaymentDetailContent({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const sats = Math.floor(payment.amountMsat / 1000);
  const feeSats = Math.floor(payment.feeMsat / 1000);
  const isReceived = payment.paymentType === "received";
  const date = new Date(payment.paymentTime * 1000);

  const statusStyles = {
    pending: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30",
    complete: "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30",
    failed: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30",
  } as const;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div
          className={`inline-flex w-12 h-12 rounded-full items-center justify-center mb-3 ${
            isReceived
              ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400"
              : "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400"
          }`}
        >
          {isReceived ? "↓" : "↑"}
        </div>
        <div
          className={`text-3xl font-bold ${
            isReceived
              ? "text-green-600 dark:text-green-400"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {isReceived ? "+" : "-"}
          {sats.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">sats</div>
        <span
          className={`inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusStyles[payment.status]}`}
        >
          {payment.status}
        </span>
      </div>

      <dl className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
        <DetailRow label="Direction" value={isReceived ? "Received" : "Sent"} />
        <DetailRow label="Fee" value={`${feeSats.toLocaleString()} sats`} />
        <DetailRow
          label="Time"
          value={`${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`}
        />
        {payment.description && (
          <DetailRow label="Description" value={payment.description} wrap />
        )}
        {payment.id && <CopyRow label="Payment ID" value={payment.id} />}
        {payment.bolt11 && <CopyRow label="Invoice" value={payment.bolt11} />}
        {payment.preimage && <CopyRow label="Preimage" value={payment.preimage} />}
      </dl>

      <Button variant="primary" size="lg" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

function DetailRow({
  label,
  value,
  wrap = false,
}: {
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="py-3 flex items-start gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd
        className={`ml-auto text-right text-gray-900 dark:text-gray-100 ${
          wrap ? "" : "truncate"
        } max-w-[60%]`}
      >
        {value}
      </dd>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked, ignore
    }
  };

  return (
    <div className="py-3 flex items-center gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <button
        onClick={copy}
        className="ml-auto inline-flex items-center gap-2 font-mono text-xs text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1.5 py-0.5"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <span>{truncated}</span>
        <span className="text-gray-400">{copied ? "✓" : "⎘"}</span>
      </button>
    </div>
  );
}
