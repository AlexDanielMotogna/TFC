import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Force dynamic rendering - pages use client-side hooks (WalletProvider)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trading Fight Club',
  description: '1v1 trading competitions on Pacifica perpetuals',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              border: '1px solid #2d2d44',
              color: '#fff',
            },
            classNames: {
              success: 'bg-surface-800 border-win-500/50',
              error: 'bg-surface-800 border-loss-500/50',
            },
          }}
        />
      </body>
    </html>
  );
}
