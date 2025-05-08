
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a fallback, Geist might not be available directly like this.
// For Geist, ensure it's correctly set up if using next/font. Default setup in original files assumes it.
// If Geist is setup via CSS variables as in the original `layout.tsx`, that is fine.
import './globals.css';
import { cn } from "@/lib/utils";

// Assuming Geist is set up via CSS variables in globals.css or similar
// For this example, I'll use Inter as a standard font. If Geist is in `next/font/google`, use that.
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: 'Diagonal Domination',
  description: 'A strategic board game of diagonal alignment and blocking.',
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
          fontSans.variable // Ensure this matches your font setup
        )}
      >
        {children}
      </body>
    </html>
  );
}
