import type { Metadata } from "next";

// app/careers/page.tsx is a client component ('use client'), which can't
// export its own `metadata` - Next.js only reads that export from server
// components. A layout can be a server component even when the page below
// it isn't, so this exists purely to give the route its own tab title
// instead of silently inheriting the root layout's "Roovert: The Truth,
// Unfiltered" on every page.
export const metadata: Metadata = {
  title: "Careers - Roovert",
  description: "Join Roovert. We're building the world's most rigorous AI engine.",
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
