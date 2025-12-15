/**
 * Balance Display Component
 * Shows Lightning balance in sats and fiat currency
 */

'use client';

import { useState, useEffect } from 'react';

interface BalanceDisplayProps {
  balanceMsat: number;
  showFiat?: boolean;
}

export function BalanceDisplay({ balanceMsat, showFiat = true }: BalanceDisplayProps) {
  const [usdRate, setUsdRate] = useState<number>(0);

  // Convert millisats to sats
  const sats = Math.floor(balanceMsat / 1000);

  // Fetch USD rate (simplified - in production, use a real API)
  useEffect(() => {
    // Mock rate - replace with actual API call
    setUsdRate(0.00042); // Example: 1 sat = $0.00042
  }, []);

  const usdValue = (sats * usdRate).toFixed(2);

  return (
    <div className="text-center py-8">
      <div className="mb-2">
        <span className="text-5xl font-bold">{sats.toLocaleString()}</span>
        <span className="text-2xl text-gray-600 dark:text-gray-400 ml-2">sats</span>
      </div>
      {showFiat && (
        <div className="text-lg text-gray-500 dark:text-gray-400">
          ≈ ${usdValue} USD
        </div>
      )}
    </div>
  );
}

interface BalanceCardProps {
  label: string;
  amountMsat: number;
  variant?: 'default' | 'primary' | 'success';
}

export function BalanceCard({ label, amountMsat, variant = 'default' }: BalanceCardProps) {
  const sats = Math.floor(amountMsat / 1000);

  const variants = {
    default: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    primary: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900',
  };

  return (
    <div className={`p-4 rounded-lg border ${variants[variant]}`}>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{sats.toLocaleString()}</div>
      <div className="text-xs text-gray-500">sats</div>
    </div>
  );
}
