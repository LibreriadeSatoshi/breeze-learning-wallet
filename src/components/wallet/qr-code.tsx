"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrCode({ value, ...props }: { readonly value: string }) {
  return (
    <div className="flex justify-center">
      <div className="p-3 bg-white rounded-lg">
        <QRCodeSVG {...props} value={value} size={200} level="M" bgColor="#FFFFFF" fgColor="#000000" />
      </div>
    </div>
  );
}
