import type { Metadata } from "next";

// See app/careers/layout.tsx for why this exists: app/privacy/page.tsx is
// a client component and can't export its own `metadata`, so without a
// layout here this route silently inherits the root layout's title.
export const metadata: Metadata = {
  title: "Privacy Policy - Roovert",
  description: "How Roovert collects, uses, and protects your data.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
