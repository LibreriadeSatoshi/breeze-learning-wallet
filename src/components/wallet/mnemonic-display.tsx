import React from 'react';

interface MnemonicDisplayProps {
  words: string[];
  revealed?: boolean;
}

export function MnemonicDisplay({ words, revealed = true }: MnemonicDisplayProps) {
  if (words.length !== 12 && words.length !== 24) {
    throw new Error('Mnemonic must have 12 or 24 words');
  }

  return (
    <ol className="grid grid-cols-2 gap-2">
      {words.map((word, index) => (
        <li
          key={index}
          className="select-none flex min-h-field items-center gap-3 rounded border border-hairline bg-raised px-3 font-mono"
        >
          <span className="w-6 flex-none text-right text-caption tabular-nums text-fg-muted">
            {index + 1}.
          </span>
          <span className={`min-w-0 truncate text-body font-medium ${revealed ? 'text-fg' : 'blur-sm select-none'}`}>
            {word}
          </span>
        </li>
      ))}
    </ol>
  );
}
