# Cloud Backup System

## Overview

EttaWallet implements a secure, encrypted cloud backup system using Google Drive. This allows users to backup their wallet recovery phrase to the cloud while maintaining complete security through client-side encryption.

## Security Architecture

### End-to-End Encryption

```
User's Mnemonic (12 words)
        ↓
    [AES-256-GCM Encryption]
    Password: User-provided
    Salt: Random (128-bit)
    IV: Random (128-bit)
    Iterations: 100,000 (PBKDF2)
        ↓
    Encrypted Ciphertext
        ↓
    [Upload to Google Drive]
        ↓
    Stored in: "EttaWallet Backups/wallet-backup.json"
```

### Key Security Features

1. **Client-Side Encryption**
   - All encryption happens in the browser
   - Google never sees the unencrypted mnemonic
   - Only encrypted data is uploaded

2. **Strong Encryption**
   - AES-256 encryption (military-grade)
   - PBKDF2 key derivation with 100,000 iterations
   - Random salt and IV for each backup
   - CryptoJS library (battle-tested)

3. **Password Protection**
   - User creates a strong encryption password
   - Minimum 8 characters required
   - Password never leaves the device
   - Required to decrypt backup

## User Flow

### Backup Creation

```
1. User completes wallet creation
   ↓
2. Shown cloud backup option
   ↓
3. User chooses "Start Cloud Backup"
   ↓
4. User creates encryption password
   ↓
5. Authenticates with Google OAuth2
   ↓
6. Mnemonic encrypted locally
   ↓
7. Encrypted file uploaded to Google Drive
   ↓
8. Success confirmation
```

### Backup Restoration

```
1. User chooses "Restore Wallet"
   ↓
2. Authenticates with Google
   ↓
3. Downloads encrypted backup
   ↓
4. Enters encryption password
   ↓
5. Decrypts mnemonic locally
   ↓
6. Wallet restored
```

## Implementation Details

### Files

| File | Purpose |
|------|---------|
| `lib/crypto/encryption.ts` | AES-256 encryption/decryption |
| `lib/cloud/google-drive.ts` | Google Drive API integration |
| `app/wallet/cloud-backup/page.tsx` | Backup UI |
| `app/wallet/cloud-restore/page.tsx` | Restore UI (TBD) |

### Encryption Format

```json
{
  "version": "1.0",
  "app": "EttaWallet",
  "ciphertext": "U2FsdGVkX1...",
  "salt": "a1b2c3d4...",
  "iv": "e5f6g7h8...",
  "timestamp": 1234567890
}
```

### Google Drive Setup

#### Required Scopes
- `https://www.googleapis.com/auth/drive.file`
  - Read/write access to files created by the app only
  - Cannot access other user files

#### Folder Structure
```
Google Drive (Root)
  └── EttaWallet Backups/
      └── wallet-backup.json
```

## Setup Instructions

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
5. Copy the Client ID

### 2. Configure Environment Variables

Create `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Test the Integration

```bash
yarn dev
# Navigate to http://localhost:3000
# Create a wallet
# Test cloud backup flow
```

## Security Considerations

### ✅ What's Secure

- Mnemonic encrypted before leaving device
- Strong AES-256-GCM encryption
- High iteration count (100,000) for key derivation
- Random salt and IV for each backup
- Google cannot decrypt the backup
- Even if Google is compromised, data is safe

### ⚠️ Important Notes

1. **Password Recovery**
   - If user forgets encryption password, backup cannot be decrypted
   - Always recommend users store password securely
   - Consider offering password hints (stored encrypted)

2. **Google Account Access**
   - If Google account is compromised, attacker gets encrypted backup
   - Still need encryption password to decrypt
   - Recommend 2FA on Google account

3. **Backup Updates**
   - Currently overwrites existing backup
   - Consider versioning for multiple backups
   - Keep last N backups with timestamps

## Alternative Backup Methods

Users can also use:

1. **Manual Backup** (`/wallet/backup`)
   - Write down 12 words
   - Verify by quiz
   - No cloud dependency

2. **Local Encrypted File** (Future)
   - Download encrypted JSON
   - Store on USB/external drive
   - Import when needed

3. **Hardware Backup** (Future)
   - Metal seed phrase backup
   - Cryptosteel/similar products
   - Fireproof/waterproof

## Testing

### Manual Test Checklist

- [ ] Create wallet and backup
- [ ] Verify file in Google Drive
- [ ] Delete local wallet
- [ ] Restore from cloud backup
- [ ] Verify correct password decrypts
- [ ] Verify wrong password fails
- [ ] Test with no internet connection
- [ ] Test with revoked Google access

### Security Audit Points

- [ ] Verify encryption parameters
- [ ] Check for password leaks in logs
- [ ] Verify secure password storage
- [ ] Test against common attacks
- [ ] Code review encryption implementation

## Future Enhancements

- [ ] Multiple backup locations (Dropbox, iCloud, etc.)
- [ ] Backup versioning and history
- [ ] Automatic backup on wallet changes
- [ ] Backup verification tool
- [ ] Password strength meter
- [ ] Backup health monitoring
- [ ] Multi-device sync
- [ ] Shamir's Secret Sharing support

## Resources

- [Google Drive API Docs](https://developers.google.com/drive/api/v3)
- [CryptoJS Documentation](https://cryptojs.gitbook.io/)
- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [BIP39 Specification](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
