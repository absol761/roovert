import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ConsentBanner } from "./components/ConsentBanner";

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
      <head>
        {/* Suppress play() Promise rejection errors from browser extensions/third-party scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Handle unhandled Promise rejections from media play() calls
              // This prevents console errors from browser extensions or third-party scripts
              window.addEventListener('unhandledrejection', function(event) {
                const error = event.reason;
                // Check if it's a media play/pause error
                if (error && (
                  error.name === 'AbortError' ||
                  error.name === 'NotAllowedError' ||
                  (error.message && (
                    error.message.includes('play()') ||
                    error.message.includes('pause()') ||
                    error.message.includes('interrupted') ||
                    error.message.includes('playback')
                  ))
                )) {
                  // Silently handle media playback errors
                  event.preventDefault();
                  return;
                }
              });
            `,
          }}
        />
      </head>
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
      </body>
    </html>
  );
}
