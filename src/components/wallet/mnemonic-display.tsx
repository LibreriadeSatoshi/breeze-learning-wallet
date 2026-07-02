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
    <div className="grid grid-cols-2 gap-3">
      {words.map((word, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-6">
            {index + 1}.
          </span>
          <span className={`font-mono font-medium ${revealed ? 'text-gray-900 dark:text-gray-100' : 'blur-sm select-none'}`}>
            {word}
          </span>
        </div>
      ))}
    </div>
  );
}

