'use client';

import Link from 'next/link';
import { NavClock } from '../nav/NavClock';
import { LiveStats } from '../nav/LiveStats';

export interface TopStripProps {
  isChatMode: boolean;
  focusMode: boolean;
  isMobile: boolean;
}

// What's left over once the icon rail (SidebarRail) took every clickable
// nav action: two purely informational widgets (clock, visitor count) plus
// the Mission/Careers text links, none of which read naturally as a single
// icon. Kept as a slim, low-chrome strip in the top-right corner rather
// than forcing them into the rail.
export function TopStrip({ isChatMode, focusMode, isMobile }: TopStripProps) {
  return (
    <div
      className="fixed top-0 right-0 z-30 flex items-center gap-3 px-4 py-3 transition-opacity duration-[var(--duration-base)]"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
        paddingRight: 'calc(env(safe-area-inset-right) + 1rem)',
      }}
    >
      {!isChatMode && (
        <div className="hidden md:flex items-center gap-5">
          <a href="#mission" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Mission
          </a>
          <Link href="/careers" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            Careers
          </Link>
          {!focusMode && <LiveStats />}
        </div>
      )}
      {!isMobile && <NavClock />}
    </div>
  );
}
