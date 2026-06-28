import type { Metadata } from 'next';
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';

// ฟอนต์ UI ภาษาไทย + ตัวเลข tabular (ยึดตาม next-accountV2)
const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: '--font-ibm-plex-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
});

// ตัวเลข/โค้ด — tabular figures
const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Notebook v2',
  description: 'ระบบ Notebook v2 — TNP',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${ibmPlexThai.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className={`${ibmPlexThai.className} flex min-h-full flex-col`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
