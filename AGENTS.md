# Scholar Wallet

## What this project is

Scholar Wallet is a standalone, non-custodial Bitcoin and Lightning wallet built with Breez SDK Spark and served as a Next.js web application.

Production: https://wallet.libreriadesatoshi.com/

## Architectural principles

1. **Non-custodial by construction.** The mnemonic is generated in the browser, stored encrypted in the browser, and never sent to any server in plaintext. No server-side mnemonic, ever, under any circumstance.
2. **No identity dependency for wallet access.** Creating, restoring, unlocking, sending, and receiving must not require an account from another platform. Optional backup services may require their own authorization.
3. **Lightning-native interface.** The wallet receives via Lightning address, BOLT11, BOLT12 offers, on-chain Bitcoin, and Spark addresses/invoices. It sends to the same set plus LNURL-pay. Anything that wants to pay this wallet uses standard Lightning. No custom integration protocols.
4. **Breez SDK Spark is the signing and networking layer.** We do not implement Lightning, on-chain Bitcoin, or Spark protocol mechanics ourselves. The SDK is the single source of truth for wallet state.
5. **The browser is the trust boundary.** Anything that crosses the browser-to-server boundary must be either public information or ciphertext that the server cannot decrypt.

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- Breez SDK Spark (`@breeztech/breez-sdk-spark`), WASM build, called from the browser
- IndexedDB for encrypted vault storage
- WebCrypto for AES-256-GCM
- `hash-wasm` for Argon2id key derivation, run in a Web Worker
- Zustand for UI state, TanStack Query for SDK-backed data
- Lucide for icons, qrcode.react for QR rendering
- No backend database in this repo. If you find yourself adding one, stop and ask why.

## Product requirements

### Onboarding
- First-run onboarding must generate a BIP-39 mnemonic in the browser, show it with copy-to-clipboard, require an inline 4-word verification, accept a wallet password, and store only the encrypted mnemonic in IndexedDB.
- Returning users must enter their password before the wallet decrypts the mnemonic in memory and initializes the Spark SDK.
- Restore must accept a typed or pasted 12-word phrase and warn before overwriting a wallet already stored on the device.
- The wallet must lock after 5 minutes of inactivity.

### Send
- The wallet must pay BOLT11 invoices, Lightning addresses through LNURL-pay, BOLT12 offers, on-chain Bitcoin addresses, Spark addresses, Spark invoices, and BIP21 URIs.
- Send must use one input and let the SDK's `parse()` determine its type.

### Receive
- **Lightning must remain primary.** On the first visit to Receive, the wallet must claim a random Lightning address (`<adjective>-<noun>-<NNN>@<lnurl-domain>`). Users may edit the username; replacing it must release the previous address.
- A one-time BOLT11 invoice must remain a secondary option for specific-amount requests.
- Bitcoin address must remain a secondary tab, generated when activated and described as funds being added to the wallet after confirmation.
- The Lightning address domain must come from `NEXT_PUBLIC_LNURL_DOMAIN` (default `pay.libreriadesatoshi.com`) and be whitelisted by Breez using a CNAME to `breez.tips`.

### On-chain claim handling
- Auto-claim must run silently with a conservative, user-configurable maximum fee leeway in sat/vB.
- The "Get refund" page (`/wallet/recovery`) must show **only** deposits whose auto-claim was rejected. It must hide mature-but-pending and not-yet-mature deposits because those are transient states.
- Refund must offer Slow, Medium, and Fast presets from `recommendedFees`, plus a custom sat/vB override.

### Sensitive actions
- "Show recovery phrase" from the home page must require fresh password re-entry through a separate decrypt path that does not change the wallet's unlock state.
- "Forget this wallet on this device" must use a destructive confirmation flow available from Settings and the welcome screen.

### Optional Google Drive backup
- Drive must hold the canonical encrypted vault so multiple devices can synchronize from the same blob.
- Authentication must use the Google Identity Services token client, and the browser must call the Drive REST API directly.
- OAuth access must use only `https://www.googleapis.com/auth/drive.appdata`, which exposes the hidden application folder rather than the user's main Drive.
- Only the encrypted vault blob may contain wallet data uploaded to Drive. Never upload the mnemonic, password, derived keys, or unencrypted wallet metadata.
- The operator must never receive an OAuth token and must not be in the Google Drive request path.
- The seed phrase must remain the primary recovery method; Drive is a convenience, not a replacement.

## Cryptography rules

- KDF: Argon2id, m=64MB, t=3, p=4, per-user random 16-byte salt. (p=4 matches RFC 9106's memory-constrained recommendation. `hash-wasm` runs p>1 serially inside a single Worker, so no SharedArrayBuffer / COOP+COEP headers are required.)
- Cipher: AES-256-GCM, random 12-byte nonce per write.
- AAD: pass `version || salt || nonce` as `additionalData` to every `SubtleCrypto.encrypt`/`decrypt` call. GCM's tag only covers ciphertext by default — binding the header into AAD makes header tampering detectable.
- Blob layout: `[1 byte: version][16 bytes: salt][12 bytes: nonce][ciphertext || 16-byte GCM tag]`.
- Library: `hash-wasm` for Argon2id (active, ~11kB gzipped WASM). Do not use `argon2-browser` — unmaintained since 2021.
- Derived keys must be non-extractable and used only inside the crypto Worker. Raw key bytes and `CryptoKey` objects must never cross the Worker boundary.
- All key derivation runs in a Web Worker. Never block the main thread on Argon2.
- Never log mnemonic, password, or derived keys. Never put them in error messages. Never send them to any analytics or error reporting.

## Code style and patterns

- TypeScript strict mode. No `any` unless commented with a reason.
- Server components for static UI, client components for anything touching the SDK or browser crypto.
- Breez SDK initialization happens once per session, behind a single service module. Do not initialize the SDK in multiple places.
- Mnemonic is held in memory only inside a single module (`wallet-store`), exposed via a narrow interface. The rest of the app sees the initialized SDK, not the seed.
- Errors that involve key material must be sanitized before they reach any UI or logging surface.
- Comments: explain WHY when non-obvious, never WHAT. Don't reference current tasks, callers, or removed code.

## Out of scope

- Learning-platform integrations.
- Rewards and payout services.
- External identity or SSO integrations.
- The LNURL server.
- Backends that store user-specific wallet state.

## When unsure

- If a feature would require a server to know the user's mnemonic or any derivative of it, refuse the design and ask.
- If a third-party integration would couple this wallet to a specific identity provider, refuse and ask.
- If the right thing to do is unclear, choose the option that keeps the wallet smaller and more independent.

## Development workflow

- Use Yarn 4 and install dependencies with `yarn install --immutable`.
- Before declaring work complete, run `yarn typecheck`, `yarn lint`, and `yarn build`.
- Add focused tests for changes to cryptography, wallet recovery, payments, parsing, and persistent storage.
- Do not commit, push, or open a pull request unless explicitly requested.

## Testing priorities

- Onboarding produces a valid BIP-39 mnemonic and a wallet that can receive funds.
- Restore from mnemonic on a new browser produces the same wallet (same identity pubkey, same balance).
- Wrong password fails decryption cleanly with no server round-trip.
- Sending and receiving work against Spark mainnet and regtest behind a config flag (`NEXT_PUBLIC_DEFAULT_NETWORK`).
- Closing the tab mid-deposit does not lose funds (verify unclaimed-deposit handling completes on the next session).
- Drive backup uploaded blob can be downloaded and decrypted with the wallet password.
