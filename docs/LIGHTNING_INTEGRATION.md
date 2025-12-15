# Lightning Integration with Breez Spark SDK

This project uses **Breez Spark SDK** for Lightning Network functionality instead of LDK (used in the React Native version).

## Why Breez Spark SDK?

- **Web-friendly**: Designed to work in browser environments
- **Simplified API**: Higher-level abstractions for Lightning operations
- **Self-custodial**: Non-custodial Lightning with LSP support
- **Production-ready**: Battle-tested in production applications

## Reference Implementation

We're using the [Breez SDK Spark Example](https://github.com/breez/breez-sdk-spark-example) as a reference for implementation patterns.

## Key Differences from LDK (React Native version)

| Feature | LDK (React Native) | Breez Spark SDK (Web) |
|---------|-------------------|----------------------|
| Platform | Mobile (iOS/Android) | Web (Browser) |
| API Level | Low-level | High-level |
| LSP Integration | Manual | Built-in |
| Channel Management | Manual | Automated |
| Backup | Manual implementation | Built-in cloud backup |

## Installation

```bash
yarn add @breeztech/breez-sdk-spark
```

## Basic Integration Steps

1. **Initialize SDK**
   - Configure network (mainnet/testnet)
   - Set up LSP connection
   - Configure storage

2. **Wallet Operations**
   - Create/Restore wallet
   - Generate receive addresses
   - Send payments (on-chain & Lightning)
   - Check balance

3. **Lightning Specific**
   - Open/close channels (automatic via LSP)
   - Send/receive Lightning payments
   - LNURL support
   - Invoice generation/payment

## Implementation Plan

- [ ] Create Spark SDK service wrapper (`src/lib/lightning/spark-service.ts`)
- [ ] Implement wallet initialization
- [ ] Add payment sending/receiving
- [ ] Integrate LNURL functionality
- [ ] Add state management for Lightning operations
- [ ] Create UI components for Lightning features

## Resources

- [Breez SDK Spark Documentation](https://sdk-doc-spark.breez.technology/)
- [Example App](https://github.com/breez/breez-sdk-spark-example)
- [API Reference](https://sdk-doc-spark.breez.technology/api/)
