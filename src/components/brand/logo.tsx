import { APP_NAME } from "@/lib/config";

interface MarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}

// The supplied artwork, swapped per theme. Ink on Paper, Paper on Ink.
export function Mark({ size = 48, className = "", decorative = false }: MarkProps) {
  const alt = decorative ? "" : "ISMOS";
  return (
    <span className={`inline-block flex-none ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ismos-mark-ink.svg" alt={alt} width={size} height={size} className="block dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ismos-mark-paper.svg" alt={alt} width={size} height={size} className="hidden dark:block" />
    </span>
  );
}

export function Lockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <Mark size={72} decorative />
      <span className="mt-3 font-wordmark text-[26px] leading-none font-medium tracking-wordmark text-heading">
        {APP_NAME}
      </span>
      <span className="mt-2 -mr-[0.4em] font-mono text-label font-medium tracking-address text-fg-muted">ISMOS.XYZ</span>
    </div>
  );
}
