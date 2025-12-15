'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useWalletStore } from '@/store/wallet-store';
import { mnemonicToWords } from '@/lib/bitcoin/mnemonic';

export default function WalletBackupPage() {
  const router = useRouter();
  const { temporaryMnemonic, isInitialized, setHasBackedUp, setInitialized, setTemporaryMnemonic } = useWalletStore();

  const [words, setWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [shuffledWords, setShuffledWords] = useState<Array<{ word: string; originalIndex: number }>>([]);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [error, setError] = useState(false);

  // Randomly select 4 words to verify
  const [wordsToVerify] = useState<number[]>(() => {
    const indices = Array.from({ length: 12 }, (_, i) => i);
    return indices.sort(() => Math.random() - 0.5).slice(0, 4).sort((a, b) => a - b);
  });

  useEffect(() => {
    // Only redirect if no mnemonic AND wallet not initialized
    // This prevents redirect after clicking Skip/Complete
    if (!temporaryMnemonic) {
      if (!isInitialized) {
        router.push('/welcome');
      }
      return;
    }

    const mnemonicWords = mnemonicToWords(temporaryMnemonic);
    setWords(mnemonicWords);

    // Create shuffled array of words to verify
    const verifyWords = wordsToVerify.map(index => ({
      word: mnemonicWords[index],
      originalIndex: index,
    }));

    // Shuffle the words
    const shuffled = [...verifyWords].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
  }, [temporaryMnemonic, isInitialized, wordsToVerify, router]);

  const handleWordSelect = (wordIndex: number) => {
    if (selectedWords.includes(wordIndex)) {
      setSelectedWords(selectedWords.filter(i => i !== wordIndex));
    } else if (selectedWords.length < 4) {
      setSelectedWords([...selectedWords, wordIndex]);
    }
    setError(false);
  };

  const handleVerify = () => {
    // Check if selected words match the original order
    const correct = selectedWords.every((selectedIndex, i) => {
      const shuffledWord = shuffledWords[selectedIndex];
      return shuffledWord.originalIndex === wordsToVerify[i];
    });

    if (correct && selectedWords.length === 4) {
      setVerificationComplete(true);
      setError(false);
    } else {
      setError(true);
      setSelectedWords([]);
    }
  };

  const handleComplete = () => {
    setHasBackedUp(true);
    setInitialized(true);
    setTemporaryMnemonic(null); // Clear temporary mnemonic
    router.push('/wallet/home');
  };

  const handleSkip = () => {
    // Allow skipping but mark as not backed up
    setHasBackedUp(false);
    setInitialized(true);
    setTemporaryMnemonic(null);
    router.push('/wallet/home');
  };

  if (!temporaryMnemonic) {
    return null;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Verify Your Recovery Phrase</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Select the words in the correct order to verify you&apos;ve written them down correctly.
          </p>
        </div>

        {!verificationComplete ? (
          <>
            {/* Word Positions to Fill */}
            <Card className="mb-6">
              <CardHeader>
                <h3 className="font-semibold">Select words #{wordsToVerify.map(i => i + 1).join(', ')}</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {wordsToVerify.map((wordIndex, slotIndex) => (
                    <div
                      key={wordIndex}
                      className="p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-center"
                    >
                      <div className="text-xs text-gray-500 mb-1">#{wordIndex + 1}</div>
                      {selectedWords[slotIndex] !== undefined ? (
                        <div className="font-mono font-medium">
                          {shuffledWords[selectedWords[slotIndex]].word}
                        </div>
                      ) : (
                        <div className="text-gray-400">?</div>
                      )}
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      ❌ Incorrect order. Please try again.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Word Selection */}
            <Card className="mb-6">
              <CardHeader>
                <h3 className="font-semibold">Tap words in order</h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {shuffledWords.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleWordSelect(index)}
                      disabled={selectedWords.includes(index)}
                      className={`p-4 rounded-lg border-2 font-mono font-medium transition-all ${
                        selectedWords.includes(index)
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 opacity-50'
                          : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                      }`}
                    >
                      {item.word}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleVerify}
                disabled={selectedWords.length !== 4}
                className="flex-1"
              >
                Verify
              </Button>
            </div>
          </>
        ) : (
          <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6 text-center">
              <div className="mb-4">
                <span className="text-6xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-2">
                Backup Verified!
              </h2>
              <p className="text-green-800 dark:text-green-300 mb-6">
                Your recovery phrase has been verified. Your wallet is now secure.
              </p>
              <Button variant="primary" size="lg" onClick={handleComplete} className="w-full">
                Continue to Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
