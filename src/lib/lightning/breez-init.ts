import { initBreez, getBalance, getNodeState, listPayments } from './breez-service';
import { useWalletStore } from '@/store/wallet-store';
import { SELECTED_BITCOIN_NETWORK } from '../config';
import type { Payment } from './types';

export interface InitResult {
  success: boolean;
  error?: string;
  nodeId?: string;
  balance?: {
    channelsBalanceMsat: number;
    maxPayableMsat: number;
    maxReceivableMsat: number;
  };
  payments?: Payment[];
}

export async function initializeBreezWallet(): Promise<InitResult> {
  try {
    console.log('🔌 Initializing Breez SDK...');
    console.log('📡 Network:', SELECTED_BITCOIN_NETWORK);

    const { temporaryMnemonic, encryptedMnemonic } = useWalletStore.getState();

    // Use temporary mnemonic if available (during setup), otherwise use persisted encrypted mnemonic
    const mnemonic = temporaryMnemonic || encryptedMnemonic;

    if (!mnemonic) {
      throw new Error('Wallet not initialized. Please create or restore a wallet first.');
    }

    await initBreez({
      network: SELECTED_BITCOIN_NETWORK as 'mainnet' | 'regtest',
      workingDir: './lightning-data',
      mnemonic: mnemonic,
    });

    console.log('✅ Breez SDK initialized');

    const nodeState = await getNodeState();
    const nodeId = nodeState?.id || null;
    
    console.log('📊 Node ID:', nodeId);

    const balance = await getBalance();
    
    console.log('💰 Balance:', balance);

    const payments = await listPayments();
    
    console.log('📜 Payments:', payments.length);

    return {
      success: true,
      nodeId,
      balance: {
        channelsBalanceMsat: balance.totalSats * 1000,
        maxPayableMsat: balance.spendableSats * 1000,
        maxReceivableMsat: balance.receivableSats * 1000,
      },
      payments,
    };
  } catch (error: any) {
    console.error('❌ Breez initialization failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to initialize Breez wallet',
    };
  }
}

export async function syncBreezWallet(): Promise<InitResult> {
  try {
    console.log('🔄 Syncing Breez wallet...');
    
    const nodeState = await getNodeState();
    const balance = await getBalance();
    const payments = await listPayments();

    console.log('✅ Sync complete');

    return {
      success: true,
      nodeId: nodeState?.id,
      balance: {
        channelsBalanceMsat: balance.totalSats * 1000,
        maxPayableMsat: balance.spendableSats * 1000,
        maxReceivableMsat: balance.receivableSats * 1000,
      },
      payments,
    };
  } catch (error: any) {
    console.error('❌ Breez sync failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync Breez wallet',
    };
  }
}

