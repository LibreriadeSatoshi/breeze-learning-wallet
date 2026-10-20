"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, ...props }: { readonly value: string }) {
  return (
    <div className="flex justify-center">
      <div className="bg-paper p-4 rounded-none">
        <QRCodeSVG {...props} value={value} size={200} level="M" bgColor="#FFFFFF" fgColor="#000000" />
      </div>
    </div>
  );
}
