import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { GlobalFightVideo } from '@/components';

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
    icon: [
      { url: '/images/logos/favicon-black-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/logos/favicon-black-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/images/logos/favicon-black-180.png', sizes: '180x180', type: 'image/png' },
    ],
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
        <GlobalFightVideo />
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
              description: 'text-[#c7c7c7]',
            },
          }}
        />
      </body>
    </html>
  );
}
