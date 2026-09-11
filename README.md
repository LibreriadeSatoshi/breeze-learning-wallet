# Scholar Wallet

A non-custodial Bitcoin/Lightning wallet, served as a Next.js web app at `wallet.libreriadesatoshi.com`.

The mnemonic is generated in the browser, stored encrypted in the browser, and never sent to any server in plaintext. Wallet signing and networking are handled by Breez SDK Spark.

See [`AGENTS.md`](./AGENTS.md) for the project's architecture, security boundaries, and development workflow.

## Getting started

The project uses Nix for the development environment and yarn for packages.

```bash
nix develop          # enter dev shell
yarn install --immutable
cp .env.example .env.local   # then fill in BREEZ_API_KEY
yarn dev
```

Open <http://localhost:3000>.

## Scripts

- `yarn dev` — Next.js dev server
- `yarn build` — production build
- `yarn start` — serve production build
- `yarn lint` — ESLint
- `yarn typecheck` — TypeScript validation

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- `@breeztech/breez-sdk-spark` — Bitcoin, Lightning, and Spark SDK
- `bip39` — mnemonic generation
- WebCrypto (AES-256-GCM) + `hash-wasm` (Argon2id) — client-side encryption
- IndexedDB — encrypted mnemonic storage
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
└── store/          Zustand stores
```

## License

Licensed under the [MIT License](./LICENSE).
