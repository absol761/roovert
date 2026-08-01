'use client';

import { motion } from 'framer-motion';
import {
  PanelLeft,
  Plus,
  MessageSquare,
  Globe,
  Command,
  Briefcase,
  Paintbrush,
  Waves,
  Loader2,
  MicOff,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// A single icon-only rail action - shared shape for every button below so
// the "expanded" (label-visible) and "collapsed" (icon-only + tooltip)
// render paths only have to be written once, in RailItem.
interface RailAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  hidden?: boolean;
}

function RailItem({ action, expanded }: { action: RailAction; expanded: boolean }) {
  if (action.hidden) return null;

  const button = (
    <Button
      type="button"
      variant="ghost"
      onClick={action.onClick}
      aria-pressed={action.active}
      className={cn(
        'w-full justify-start gap-3 text-[var(--muted)] hover:text-[var(--foreground)]',
        expanded ? 'px-3' : 'px-0 justify-center',
        action.active && 'bg-[var(--surface-strong)] text-[var(--foreground)]'
      )}
      size={expanded ? 'default' : 'icon'}
    >
      <span className="flex items-center justify-center shrink-0">{action.icon}</span>
      {expanded && <span className="text-sm truncate">{action.label}</span>}
    </Button>
  );

  if (expanded) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{action.label}</TooltipContent>
    </Tooltip>
  );
}

export interface SidebarRailProps {
  isChatMode: boolean;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenGlobalFeed: () => void;
  onOpenCommandPalette: () => void;
  onOpenLooks: () => void;
  onOpenSettings: () => void;
  // Visualizer toggle - gated behind Settings ("showVisualizerButton"),
  // mirrors the exact behavior/animated mic-reactive rings the old nav
  // button had, just relocated into the rail.
  showVisualizerButton: boolean;
  visualizerEnabled: boolean;
  onToggleVisualizer: () => void;
  micStatus: 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported';
  micLevel: number;
  micBurst: number;
  // Controlled (lifted to page.tsx) rather than local state: the main
  // content area's left padding needs to track this exact value too, so
  // an expanded rail (200px) doesn't overlap/cover content that was only
  // ever given clearance for the collapsed width (64px).
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

// Desktop-only slim icon rail, collapsed (icon-only) by default. Every
// action the old top <nav> exposed (minus the purely-decorative
// NavClock/LiveStats, which stay in the slim top strip - see
// TopStrip.tsx) lives here now.
export function SidebarRail({
  isChatMode,
  onNewChat,
  onOpenHistory,
  onOpenGlobalFeed,
  onOpenCommandPalette,
  onOpenLooks,
  onOpenSettings,
  showVisualizerButton,
  visualizerEnabled,
  onToggleVisualizer,
  micStatus,
  micLevel,
  micBurst,
  expanded,
  onExpandedChange,
}: SidebarRailProps) {

  const topActions: RailAction[] = [
    {
      key: 'history',
      label: 'Conversation history',
      icon: <MessageSquare className="w-[18px] h-[18px]" />,
      onClick: onOpenHistory,
    },
    {
      key: 'feed',
      label: 'Global feed',
      icon: <Globe className="w-[18px] h-[18px]" />,
      onClick: onOpenGlobalFeed,
    },
    {
      key: 'palette',
      label: 'Quick actions (Cmd+K)',
      icon: <Command className="w-[18px] h-[18px]" />,
      onClick: onOpenCommandPalette,
    },
    {
      key: 'careers',
      label: 'Careers',
      icon: <Briefcase className="w-[18px] h-[18px]" />,
      onClick: () => {
        window.location.href = '/careers';
      },
      hidden: isChatMode,
    },
    {
      key: 'looks',
      label: 'Looks & theme',
      icon: <Paintbrush className="w-[18px] h-[18px]" />,
      onClick: onOpenLooks,
    },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 200 : 64 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col items-stretch gap-1 border-r border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-xl py-3 px-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      aria-label="Primary navigation"
    >
      <div className={cn('flex items-center', expanded ? 'justify-between px-1' : 'justify-center')}>
        {expanded && (
          <button
            type="button"
            onClick={onNewChat}
            className="serif-display text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors px-1"
            title="Roovert - New Chat"
          >
            Roovert
          </button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onExpandedChange(!expanded)}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
              aria-pressed={expanded}
            >
              <PanelLeft className="w-[18px] h-[18px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{expanded ? 'Collapse sidebar' : 'Expand sidebar'}</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-1 py-1">
        {expanded ? (
          <Button
            type="button"
            onClick={onNewChat}
            className="w-full justify-start gap-3 rounded-full"
            size="default"
          >
            <Plus className="w-[18px] h-[18px]" />
            <span className="text-sm">New chat</span>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={onNewChat}
                size="icon"
                className="w-full rounded-full mx-auto"
                aria-label="New chat"
              >
                <Plus className="w-[18px] h-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New chat</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator className="my-1" />

      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {topActions.map((action) => (
          <RailItem key={action.key} action={action} expanded={expanded} />
        ))}

        {showVisualizerButton && (
          <VisualizerRailButton
            expanded={expanded}
            enabled={visualizerEnabled}
            onToggle={onToggleVisualizer}
            micStatus={micStatus}
            micLevel={micLevel}
            micBurst={micBurst}
          />
        )}
      </nav>

      <Separator className="my-1" />

      <div className="px-1">
        <RailItem
          action={{
            key: 'settings',
            label: 'Settings',
            icon: (
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--surface-strong)] border border-[var(--border)]">
                <Settings className="w-3.5 h-3.5" />
              </span>
            ),
            onClick: onOpenSettings,
          }}
          expanded={expanded}
        />
      </div>
    </motion.aside>
  );
}

// Preserves the exact mic-reactive ring/burst/breathing animation the old
// top-nav Waves button had (see git history of app/page.tsx), just resized
// to sit naturally inside the rail's icon column.
function VisualizerRailButton({
  expanded,
  enabled,
  onToggle,
  micStatus,
  micLevel,
  micBurst,
}: {
  expanded: boolean;
  enabled: boolean;
  onToggle: () => void;
  micStatus: SidebarRailProps['micStatus'];
  micLevel: number;
  micBurst: number;
}) {
  const title =
    micStatus === 'denied'
      ? 'Microphone blocked — allow it in your browser’s site settings, then click to retry'
      : micStatus === 'unsupported'
        ? 'Audio-Reactive Visualizer needs microphone support this browser doesn’t provide'
        : micStatus === 'requesting'
          ? 'Requesting microphone access…'
          : enabled
            ? 'Listening — click to turn off'
            : 'Audio-Reactive Visualizer (uses microphone) — click to turn on';

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(
        'relative overflow-visible flex items-center gap-3 rounded-lg transition-all group w-full',
        expanded ? 'px-3 h-9' : 'justify-center h-9',
        micStatus === 'denied' || micStatus === 'unsupported'
          ? 'bg-red-500/10 text-red-400'
          : enabled
            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--foreground)]'
      )}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {micStatus === 'requesting' && 'Requesting microphone access'}
        {micStatus === 'active' && 'Microphone connected, visualizer listening'}
        {micStatus === 'denied' && 'Microphone access denied'}
        {micStatus === 'unsupported' && 'Microphone not supported in this browser'}
      </span>

      <span className="relative flex items-center justify-center w-[18px] h-[18px] shrink-0">
        {enabled && micStatus === 'active' && (
          <>
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-[var(--accent)]/50"
              animate={{ scale: 1 + micLevel * 0.85, opacity: 0.55 - micLevel * 0.25 }}
              transition={{ type: 'spring', stiffness: 140, damping: 15, mass: 0.5 }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[var(--accent)]/25 blur-[2px]"
              animate={{ scale: 1 + micLevel * 0.5, opacity: 0.4 + micLevel * 0.6 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, mass: 0.4 }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-[var(--accent)]"
              animate={{ scale: 1 + micBurst * 1.1, opacity: micBurst * 0.7 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.3 }}
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-[var(--accent)]/25"
              animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </>
        )}
        {enabled && micStatus === 'requesting' && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-[var(--accent)]/40 border-t-[var(--accent)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {micStatus === 'requesting' ? (
          <Loader2 className="w-[18px] h-[18px] relative z-10 animate-spin" />
        ) : micStatus === 'denied' || micStatus === 'unsupported' ? (
          <MicOff className="w-[18px] h-[18px] relative z-10 group-hover:scale-110 transition-transform" />
        ) : (
          <Waves className="w-[18px] h-[18px] relative z-10 group-hover:scale-110 transition-transform" />
        )}
      </span>
      {expanded && <span className="text-sm truncate">Visualizer</span>}
    </button>
  );

  if (expanded) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">{title}</TooltipContent>
    </Tooltip>
  );
}
