import type { Metadata } from 'next';
import { Libre_Franklin, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { BetaBanner } from '@/components/ui/beta-banner';

const libreFranklin = Libre_Franklin({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'discovred - Revenue Intelligence Platform',
  description: 'Revenue intelligence and pricing analytics for subscription businesses on Stripe',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${libreFranklin.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <BetaBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}


