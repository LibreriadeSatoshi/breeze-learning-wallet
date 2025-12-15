/**
 * Mnemonic Display Component
 * Shows the 12-word recovery phrase in a grid
 */

import React from 'react';

interface MnemonicDisplayProps {
  words: string[];
  revealed?: boolean;
}

export function MnemonicDisplay({ words, revealed = true }: MnemonicDisplayProps) {
  if (words.length !== 12) {
    throw new Error('Mnemonic must have exactly 12 words');
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

interface MnemonicWordProps {
  word: string;
  index: number;
}

export function MnemonicWord({ word, index }: MnemonicWordProps) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <span className="text-xs font-medium text-gray-400 w-4">{index}.</span>
      <span className="font-mono text-sm font-medium">{word}</span>
    </div>
  );
}
