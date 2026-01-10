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
              // Suppress errors from browser extensions and third-party scripts
              (function() {
                // Suppress console errors from browser extensions
                const originalError = console.error;
                console.error = function(...args) {
                  const message = args.join(' ');
                  // Suppress known browser extension errors
                  if (
                    message.includes('browser_extension') ||
                    message.includes('Content Script Bridge') ||
                    message.includes('Floating K') ||
                    message.includes('Kami') ||
                    message.includes('Invalid Authorization') ||
                    message.includes('unexpected_response') ||
                    message.includes('api/browser_extension')
                  ) {
                    return; // Silently ignore extension errors
                  }
                  // Call original for legitimate errors
                  originalError.apply(console, args);
                };

                // Handle unhandled Promise rejections from media play() calls and extensions
                window.addEventListener('unhandledrejection', function(event) {
                  const error = event.reason;
                  const errorMessage = error?.message || error?.toString() || '';
                  
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
                    event.preventDefault();
                    return;
                  }
                  
                  // Suppress browser extension API errors
                  if (
                    errorMessage.includes('browser_extension') ||
                    errorMessage.includes('Invalid Authorization') ||
                    errorMessage.includes('unexpected_response') ||
                    errorMessage.includes('Kami')
                  ) {
                    event.preventDefault();
                    return;
                  }
                });
              })();
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
