// Type overrides for Solana wallet adapter to fix React version conflicts
import '@solana/wallet-adapter-react';
import '@solana/wallet-adapter-react-ui';

declare module '@solana/wallet-adapter-react' {
  import { FC, ReactNode } from 'react';

  export interface ConnectionProviderProps {
    children: ReactNode;
    endpoint: string;
    config?: object;
  }

  export interface WalletProviderProps {
    children: ReactNode;
    wallets: unknown[];
    autoConnect?: boolean;
    onError?: (error: Error) => void;
  }

  export const ConnectionProvider: FC<ConnectionProviderProps>;
  export const WalletProvider: FC<WalletProviderProps>;
}

declare module '@solana/wallet-adapter-react-ui' {
  import { FC, ReactNode } from 'react';

  export interface WalletModalProviderProps {
    children: ReactNode;
  }

  export const WalletModalProvider: FC<WalletModalProviderProps>;
  export const WalletMultiButton: FC<object>;
}
