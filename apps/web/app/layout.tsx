import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { SkipLink } from '../components/SkipLink';
import './globals.css';

export const metadata: Metadata = {
  title: 'Notice Exorcist',
  description:
    'Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited reply you approve.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
