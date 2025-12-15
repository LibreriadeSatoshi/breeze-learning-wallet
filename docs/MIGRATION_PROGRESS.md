# Migration Progress

## ✅ Completed

### Project Setup
- [x] Fresh Next.js 15 project with App Router
- [x] TypeScript configuration
- [x] Tailwind CSS setup
- [x] Nix flake for reproducible development environment
- [x] Project directory structure (lib, components, types, store)
- [x] ESLint configuration

### UI Components
- [x] Button component (primary, secondary, outline, ghost variants)
- [x] Input component (with labels, errors, helper text)
- [x] Card component (with Header, Content, Footer)
- [x] Responsive, dark mode support

### Pages/Screens
- [x] Welcome page (/welcome)
  - Create new wallet
  - Restore wallet
  - Modern, clean design
- [x] Home page redirect

### Configuration
- [x] Environment variables setup (.env.example)
- [x] App configuration (config.ts)
- [x] Bitcoin network settings
- [x] LSP configuration placeholders

### Lightning Integration
- [x] Breez Spark SDK installed
- [x] Spark service wrapper created
- [x] Basic Lightning operations defined:
  - initSpark()
  - receivePayment()
  - sendPayment()
  - getBalance()
  - listPayments()

### Documentation
- [x] README updated
- [x] Lightning integration guide
- [x] Migration progress tracker

## 🚧 In Progress

- [ ] Bitcoin utility functions
- [ ] State management setup

## 📋 Todo

### Core Functionality
- [ ] Port Bitcoin utilities (address generation, transaction building)
- [ ] Port nobble_ecc.ts for cryptographic operations
- [ ] Set up Zustand for state management
- [ ] Create wallet context/store
- [ ] Implement wallet creation logic
- [ ] Implement wallet restoration logic

### Screens to Migrate
- [ ] Wallet Home Screen (dashboard)
  - Balance display
  - Transaction list
  - Send/Receive buttons
- [ ] Send Screen
  - Amount input
  - Address/invoice input
  - QR scanner
- [ ] Receive Screen
  - Address/invoice display
  - QR code generation
  - Amount specification
- [ ] Activity/Transaction History
- [ ] Settings screens

### Features
- [ ] QR code scanning (web camera API)
- [ ] QR code generation
- [ ] Internationalization (i18n)
- [ ] Local storage for wallet data
- [ ] IndexedDB for larger data
- [ ] Toast notifications
- [ ] Modal dialogs
- [ ] Loading states
- [ ] Error handling

### Advanced
- [ ] LNURL support (pay, withdraw, auth)
- [ ] Contact management
- [ ] Currency conversion
- [ ] Faucet integration (testnet)
- [ ] Channel management UI
- [ ] Backup/restore flows

## 🎯 Next Steps

1. **Set up state management** (Zustand)
   - Create wallet store
   - Create Lightning store
   - Persist state to localStorage

2. **Port Bitcoin core**
   - Copy bitcoin.ts utilities
   - Copy nobble_ecc.ts
   - Adapt for web environment

3. **Build Wallet Home Screen**
   - Balance display component
   - Transaction list component
   - Action buttons (Send/Receive)

4. **Implement wallet creation**
   - Generate mnemonic
   - Derive keys
   - Initialize Spark SDK
   - Save to storage

## 📊 Progress: ~20%

**Files Created:** 15+
**Components:** 3 UI components
**Services:** 1 Lightning service
**Pages:** 2 (home, welcome)
