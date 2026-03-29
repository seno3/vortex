import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter, Playfair_Display } from 'next/font/google';
import { PreferredUnitProvider } from '@/context/PreferredUnitContext';
import './globals.css';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Vigil',
  description: 'Community safety intelligence platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full overflow-hidden ${ibmPlexMono.variable} ${inter.variable} ${playfairDisplay.variable}`}>
      <body className="bg-[#0a0e17] text-white antialiased h-full min-h-0 overflow-hidden">
        <PreferredUnitProvider>{children}</PreferredUnitProvider>
      </body>
    </html>
  );
}
