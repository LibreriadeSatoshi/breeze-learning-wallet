# Etta Wallet Web

A modern Bitcoin & Lightning wallet built with Next.js, TypeScript, and Tailwind CSS.

## Getting Started

### Prerequisites

This project uses Nix for development environment management.

### Setup

1. Enter the Nix development environment:
```bash
nix develop
```

2. Install dependencies:
```bash
yarn install
```

3. Run the development server:
```bash
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
etta-wallet-web/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # Reusable React components
│   ├── lib/          # Utility functions and Bitcoin/Lightning logic
│   └── types/        # TypeScript type definitions
├── public/           # Static assets
└── flake.nix        # Nix development environment
```

## Migration from React Native

This is a fresh web-native implementation migrated from the React Native version. Core wallet logic and business rules are being ported from the original codebase.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Bitcoin**: bitcoinjs-lib
- **Lightning**: Breez Spark SDK
- **State Management**: Zustand (planned)

## Development

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
