import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const baseStyles = 'rounded border border-hairline bg-surface text-fg';

export function Card({ children, className = '' }: CardProps) {
  return <div className={`${baseStyles} ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
