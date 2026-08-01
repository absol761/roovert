'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Plus, MessageSquare, Globe, Briefcase, Paintbrush, Waves, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export interface MobileNavProps {
  isChatMode: boolean;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenGlobalFeed: () => void;
  onOpenLooks: () => void;
  onOpenSettings: () => void;
  showVisualizerButton: boolean;
  visualizerEnabled: boolean;
  onToggleVisualizer: () => void;
}

// Mobile equivalent of SidebarRail: the rail is a desktop icon-column
// pattern that doesn't translate to a narrow viewport, so on mobile every
// one of the same actions instead lives in a hamburger-triggered slide-over
// (shadcn Sheet), opened from a small top-left button.
export function MobileNav({
  isChatMode,
  onNewChat,
  onOpenHistory,
  onOpenGlobalFeed,
  onOpenLooks,
  onOpenSettings,
  showVisualizerButton,
  visualizerEnabled,
  onToggleVisualizer,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const runAndClose = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div
      className="md:hidden fixed top-0 left-0 z-40"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingLeft: 'calc(env(safe-area-inset-left) + 0.75rem)' }}
    >
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="bg-[var(--background)]/80 backdrop-blur-xl border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] rounded-full"
            aria-label="Open menu"
          >
            <Menu className="w-[18px] h-[18px]" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-[var(--background)] border-[var(--border)] flex flex-col">
          <SheetHeader>
            <SheetTitle className="serif-display text-lg text-left">Roovert</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-4 pb-4 flex-1 overflow-y-auto">
            <Button onClick={runAndClose(onNewChat)} className="justify-start gap-3 rounded-full mb-2">
              <Plus className="w-4 h-4" />
              New chat
            </Button>

            <Button variant="ghost" onClick={runAndClose(onOpenHistory)} className="justify-start gap-3 text-[var(--muted)]">
              <MessageSquare className="w-4 h-4" />
              Conversation history
            </Button>
            <Button variant="ghost" onClick={runAndClose(onOpenGlobalFeed)} className="justify-start gap-3 text-[var(--muted)]">
              <Globe className="w-4 h-4" />
              Global feed
            </Button>
            {!isChatMode && (
              <Button variant="ghost" asChild className="justify-start gap-3 text-[var(--muted)]">
                <Link href="/careers" onClick={() => setOpen(false)}>
                  <Briefcase className="w-4 h-4" />
                  Careers
                </Link>
              </Button>
            )}
            <Button variant="ghost" onClick={runAndClose(onOpenLooks)} className="justify-start gap-3 text-[var(--muted)]">
              <Paintbrush className="w-4 h-4" />
              Looks & theme
            </Button>
            {showVisualizerButton && (
              <Button
                variant="ghost"
                onClick={runAndClose(onToggleVisualizer)}
                aria-pressed={visualizerEnabled}
                className={`justify-start gap-3 ${visualizerEnabled ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
              >
                <Waves className="w-4 h-4" />
                Visualizer
              </Button>
            )}

            <Separator className="my-2" />

            <Button variant="ghost" onClick={runAndClose(onOpenSettings)} className="justify-start gap-3 text-[var(--muted)]">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
