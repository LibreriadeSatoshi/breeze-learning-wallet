import React from 'react';
import { WarningTriangle } from 'iconoir-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  inputType?: InputType;
  element?: React.ReactNode;
}

type InputType = "input" | "element"

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  inputType = "input",
  element,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const ariaDescribedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-body-sm font-semibold text-fg mb-2"
        >
          {label}
        </label>
      )}
      
      {inputType === "element" && 
      <div className="w-full min-h-field px-3 rounded border-1.5 border-input bg-surface text-fg text-body flex flex-row justify-between items-center gap-2">{element}</div>}
    
      {inputType === "input" && <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={ariaDescribedBy}
        className={`
          w-full min-h-field px-3 rounded bg-surface text-fg text-body
          placeholder:text-logwood-600
          transition-colors duration-fast
          disabled:cursor-not-allowed disabled:border-hairline disabled:text-logwood-600
          ${error
            ? 'border-2 border-alert'
            : 'border-1.5 border-input hover:border-strong focus-visible:border-2 focus-visible:border-strong'
          }
          ${className}
        `}
        {...props}
      />}
      {error && (
        <p id={errorId} className="mt-2 flex items-start gap-2 text-body-sm text-alert">
          <WarningTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="mt-2 text-body-sm text-fg-muted">{helperText}</p>
      )}
    </div>
  );
}
