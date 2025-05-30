
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";
import { LanguageProvider } from '@/contexts/LanguageContext';

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Default metadata. Specific pages can override this or use dynamic metadata.
export const metadata: Metadata = {
  title: 'CaroQuest', // Default title
  description: 'A strategic board game of diagonal alignment and blocking.', // Default description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
