// The outer shell shared by every page: fonts, <html>, <body>.
// Each page's content is inserted where {children} is.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Text shown in the browser tab and in search results.
export const metadata: Metadata = {
  title: "Tabby — get paid for every milestone",
  description:
    "Tabby holds client payments with PayPal and uses AI to check delivery and defend disputes.",
  // Stop iPhones turning PayPal IDs, amounts and dates into phone/date
  // links. They edit the page to do it, which clashes with React.
  formatDetection: { telephone: false, date: false, email: false, address: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browsers sometimes add their own attributes
    // to <html> (e.g. Chrome on iPhone adds __gcrremoteframetoken). This
    // tells React to ignore that — for this one tag only, not its contents.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
