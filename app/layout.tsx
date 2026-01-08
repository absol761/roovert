import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ConsentBanner } from "./components/ConsentBanner";
import { ParticleCursor } from "./components/ParticleCursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Roovert: The Truth, Unfiltered",
  description: "Rigorously Pursuing Truth. An AI Engine of Truth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Skip to main content for accessibility */}
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        {/* Privacy-focused visitor tracker - non-blocking, lightweight */}
        <Script src="/tracker.js" strategy="afterInteractive" />
        {children}
        <ConsentBanner />
        <ParticleCursor />
      </body>
    </html>
  );
}
