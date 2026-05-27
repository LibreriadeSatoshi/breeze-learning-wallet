# Scholar Wallet

A non-custodial Bitcoin/Lightning wallet, served as a Next.js web app at `wallet.libreriadesatoshi.com`.

The mnemonic is generated in the browser, stored encrypted in the browser, and never sent to any server in plaintext. Lightning routing, swaps, and Liquid transactions are handled by Breez SDK Liquid.

See [`CLAUDE.md`](./CLAUDE.md) for the architectural rules — it is the source of truth for what does and does not belong in this repo.

## Getting started

The project uses Nix for the development environment and yarn for packages.

```bash
nix develop          # enter dev shell
yarn install
cp .env.example .env.local   # then fill in BREEZ_API_KEY
yarn dev
```

Open <http://localhost:3000>.

## Scripts

- `yarn dev` — Next.js dev server
- `yarn build` — production build
- `yarn start` — serve production build
- `yarn lint` — ESLint

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- [`@breeztech/breez-sdk-liquid`](https://sdk-doc-liquid.breez.technology/) — Lightning + Liquid (WASM, browser)
- `bip39` — mnemonic generation
- WebCrypto (AES-256-GCM) + argon2-browser (KDF) — client-side encryption *(in progress)*
- IndexedDB — encrypted mnemonic storage *(in progress)*
- Zustand — UI state
- TanStack Query — SDK data fetching

## Project layout

```
src/
├── app/            Next.js App Router pages and API routes
├── components/     Reusable React components
├── hooks/          React Query hooks over the Breez SDK
├── lib/            SDK wrappers, crypto, config
├── providers/      React providers (Query)
├── store/          Zustand stores
└── types/          Shared TypeScript types
```

## Status

Phase 1 work is in progress. See `CLAUDE.md` for the phased roadmap (core wallet → Lightning address → recovery beyond the mnemonic).
