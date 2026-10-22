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
  quiet?: boolean;
}

// Status is never carried by colour alone: colour, icon and the word together.
// Quiet keeps the icon, word and border but drops the fill, so Weld stays on the one critical warning per screen.
export function StatusNote({ status, children, className = "", role, quiet = false }: StatusNoteProps) {
  const t = useT();
  const Icon = icons[status];
  const look = quiet ? "border-1.5 border-strong text-fg" : styles[status];
  return (
    <div role={role} className={`rounded p-4 ${look} ${className}`}>
      <p className="flex items-center gap-2 font-mono text-label font-semibold tracking-label">
        <Icon aria-hidden="true" className="h-5 w-5 flex-none" />
        {t(words[status])}
      </p>
      <div className="mt-2 text-body-sm">{children}</div>
    </div>
  );
}
