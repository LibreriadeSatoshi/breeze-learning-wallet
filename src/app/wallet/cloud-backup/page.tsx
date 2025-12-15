'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useWalletStore } from '@/store/wallet-store';
import { encryptMnemonic } from '@/lib/crypto/encryption';
import { authenticateGoogle, uploadBackup } from '@/lib/cloud/google-drive';

export default function CloudBackupPage() {
  const router = useRouter();
  const { temporaryMnemonic, setHasBackedUp, setInitialized, setTemporaryMnemonic } = useWalletStore();

  const [step, setStep] = useState<'intro' | 'password' | 'uploading' | 'success'>('intro');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleStartBackup = () => {
    setStep('password');
  };

  const validatePassword = (): boolean => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    setError('');
    return true;
  };

  const handleBackup = async () => {
    if (!validatePassword()) return;
    if (!temporaryMnemonic) {
      setError('No mnemonic found. Please start wallet creation again.');
      return;
    }

    setStep('uploading');
    setError('');

    try {
      // 1. Authenticate with Google
      const authenticated = await authenticateGoogle();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Google');
      }

      // 2. Encrypt mnemonic
      const encryptedData = encryptMnemonic(temporaryMnemonic, password);

      // 3. Upload to Google Drive
      const uploaded = await uploadBackup(encryptedData);
      if (!uploaded) {
        throw new Error('Failed to upload backup');
      }

      // 4. Success
      setStep('success');
      setHasBackedUp(true);
    } catch (err: any) {
      setError(err.message || 'Backup failed. Please try again.');
      setStep('password');
    }
  };

  const handleComplete = () => {
    setInitialized(true);
    setTemporaryMnemonic(null); // Clear temporary mnemonic
    router.push('/wallet/home');
  };

  const handleSkip = () => {
    router.push('/wallet/backup'); // Go to manual backup instead
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {step === 'intro' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Cloud Backup</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Securely backup your wallet to Google Drive with encryption
              </p>
            </div>

            <Card className="mb-6 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">☁️</span>
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                      How Cloud Backup Works
                    </h3>
                    <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
                      <li>✓ Your recovery phrase is encrypted with your password</li>
                      <li>✓ The encrypted file is saved to your Google Drive</li>
                      <li>✓ Only you can decrypt it with your password</li>
                      <li>✓ Google cannot access your recovery phrase</li>
                    </ul>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                      <h4 className="font-medium mb-1">End-to-End Encrypted</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your backup is encrypted before upload using AES-256 encryption
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🔑</span>
                    <div>
                      <h4 className="font-medium mb-1">Password Protected</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Create a strong password to encrypt your backup
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">☁️</span>
                    <div>
                      <h4 className="font-medium mb-1">Automatic Sync</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Access your backup from any device by signing in to Google
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={handleSkip} className="flex-1">
                Use Manual Backup
              </Button>
              <Button variant="primary" size="lg" onClick={handleStartBackup} className="flex-1">
                Start Cloud Backup
              </Button>
            </div>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Create Encryption Password</h1>
              <p className="text-gray-600 dark:text-gray-400">
                This password encrypts your backup. Keep it safe!
              </p>
            </div>

            <Card className="mb-6 border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  ⚠️ <strong>Important:</strong> If you forget this password, you won&apos;t be able to restore from cloud backup. Make sure to remember it or store it securely.
                </p>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardContent className="pt-6 space-y-4">
                <Input
                  label="Encryption Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  error={error && password.length < 8 ? error : undefined}
                />

                <Input
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  error={error && password !== confirmPassword ? error : undefined}
                />

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">Show passwords</span>
                </label>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={() => setStep('intro')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleBackup}
                disabled={!password || !confirmPassword}
                className="flex-1"
              >
                Encrypt & Backup
              </Button>
            </div>
          </>
        )}

        {step === 'uploading' && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Creating Backup...</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Encrypting and uploading to Google Drive
              </p>
            </CardContent>
          </Card>
        )}

        {step === 'success' && (
          <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6 text-center">
              <div className="mb-4">
                <span className="text-6xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-2">
                Backup Complete!
              </h2>
              <p className="text-green-800 dark:text-green-300 mb-6">
                Your wallet has been securely backed up to Google Drive
              </p>
              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold mb-2">What&apos;s backed up:</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>✓ Your 12-word recovery phrase (encrypted)</li>
                  <li>✓ Stored in: Google Drive / EttaWallet Backups</li>
                  <li>✓ Protected with your encryption password</li>
                </ul>
              </div>
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
