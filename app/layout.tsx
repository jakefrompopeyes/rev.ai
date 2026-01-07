import type { Metadata } from 'next';
import { Libre_Franklin, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

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
  title: 'REV.AI - Revenue Intelligence Platform',
  description: 'AI-powered revenue intelligence for subscription businesses',
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
          {children}
        </Providers>
      </body>
    </html>
  );
}


