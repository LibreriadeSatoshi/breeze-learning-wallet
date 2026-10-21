"use client";

import React from "react";
import { Check, InfoCircle, WarningTriangle } from "iconoir-react";
import { useT } from "@/lib/i18n/hook";

type Status = "info" | "success" | "warning" | "error";

const styles: Record<Status, string> = {
  info: "bg-info-bg text-info",
  success: "border-1.5 border-success text-success",
  warning: "border-1.5 border-ink bg-warning-bg text-warning",
  error: "border-2 border-error text-error",
};

const icons: Record<Status, typeof Check> = {
  info: InfoCircle,
  success: Check,
  warning: WarningTriangle,
  error: WarningTriangle,
};

const words: Record<Status, string> = {
  info: "common.status.note",
  success: "common.status.done",
  warning: "common.status.check",
  error: "common.status.error",
};

interface StatusNoteProps {
  status: Status;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}

// Status is never carried by colour alone: colour, icon and the word together.
export function StatusNote({ status, children, className = "", role }: StatusNoteProps) {
  const t = useT();
  const Icon = icons[status];
  return (
    <div role={role} className={`rounded p-4 ${styles[status]} ${className}`}>
      <p className="flex items-center gap-2 font-mono text-label font-semibold tracking-label">
        <Icon aria-hidden="true" className="h-5 w-5 flex-none" />
        {t(words[status])}
      </p>
      <div className="mt-2 text-body-sm">{children}</div>
    </div>
  );
}
