export const APP_NAME = 'Satoshi Scholar';
export const APP_TAGLINE = 'Learn Bitcoin, Earn Rewards';

export type SparkNetwork = 'mainnet' | 'regtest';

export const SELECTED_BITCOIN_NETWORK: SparkNetwork =
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK === 'mainnet' ? 'mainnet' : 'regtest';

export const LNURL_DOMAIN: string | undefined =
  process.env.NEXT_PUBLIC_LNURL_DOMAIN || undefined;

export const GOOGLE_OAUTH_CLIENT_ID: string | undefined =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || undefined;
