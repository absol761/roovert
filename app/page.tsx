'use client';

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Zap, Settings, X, Globe, ChevronDown, Maximize, Minimize, Square, Paperclip, Edit2, RefreshCw, Search, Code, Star, ArrowRight, Paintbrush, Mic, MessageSquarePlus, ImageIcon, History, ThumbsUp, ThumbsDown, Download, Focus, Keyboard, Cpu, Copy, Check } from 'lucide-react';
import { useMobile } from './hooks/useMobile';
import { MarkdownMessage } from './components/MarkdownMessage';
import { useMicLevel } from './hooks/useMicLevel';
import { useSpeechToText } from './hooks/useSpeechToText';
import { LooksModal } from './components/modals/LooksModal';
import { MoreModelsModal } from './components/modals/MoreModelsModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ConversationHistoryModal } from './components/modals/ConversationHistoryModal';
import { CommandPaletteModal, type CommandAction } from './components/modals/CommandPaletteModal';
import { ShortcutsHelpModal } from './components/modals/ShortcutsHelpModal';
import { GlobalFeedExpanded } from './components/GlobalFeedExpanded';
import { NeuralNoise } from './components/NeuralNoise';
import { SidebarRail } from './components/layout/SidebarRail';
import { MobileNav } from './components/layout/MobileNav';
import { TopStrip } from './components/layout/TopStrip';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MODELS, OPENROUTER_MODELS, HUGGINGFACE_MODELS } from './lib/models';
import { QUICK_PROMPTS, SIGNALS } from './lib/constants';
import { getSystemPrompt, getStyleInstruction, getLengthInstruction, type ResponseStyle, type OutputLength } from './lib/prompts';
import type { VisualizerMode } from './components/visualizer/R3FVisualizer';
// Plain 2D canvas, not three.js - cheap enough to not need the dynamic-import
// treatment the R3F visualizer components above get.
import { MicFrequencyBars } from './components/visualizer/MicFrequencyBars';

// Both pull in react-three-fiber/three/drei (a large 3D dependency) so they're
// only ever fetched by the browser once the visualizer is actually opened,
// instead of shipping in every visitor's initial bundle.
const R3FVisualizer = dynamic(() => import('./components/visualizer/R3FVisualizer'), { ssr: false });
const VisualizerConfigPanel = dynamic(
  () => import('./components/visualizer/VisualizerConfigPanel').then(m => m.VisualizerConfigPanel),
  { ssr: false }
);

type ChatContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

type HistoryTurn = {
  query: string;
  response: string;
  model: string;
  image?: string;
  perspectives?: Array<{ model: string; content: string }>;
  generatedImage?: string;
  // Extended-thinking text for reasoning-capable models (DeepSeek R1, Kimi
  // K3), persisted per-turn once streaming finishes.
  reasoning?: string;
};

// What actually gets persisted per turn - `image`/`generatedImage` are
// dropped (see MAX_PERSISTED_TURNS comment below), so a stored turn is a
// strict subset of the in-memory one.
type PersistedHistoryTurn = Pick<HistoryTurn, 'query' | 'response' | 'model' | 'perspectives' | 'reasoning'>;

interface Conversation {
  id: string;
  title: string;
  // Whether `title` came from the user renaming it (vs. the auto-generated
  // heuristic below) - guards against the auto-title recomputation
  // clobbering a rename on the next persist.
  titleIsCustom: boolean;
  history: PersistedHistoryTurn[];
  isChatMode: boolean;
  createdAt: number;
  updatedAt: number;
}

// Legacy single-conversation key from before multi-conversation history
// existed. Only ever read once, on mount, to migrate an existing user's
// in-progress chat into the new list format - see the hydrate effect below.
const CONVERSATION_STORAGE_KEY = 'roovert_conversation';
// Where the full conversation list + which one is active is persisted, so a
// refresh/crash/accidental tab close doesn't lose any of them.
const CONVERSATIONS_STORAGE_KEY = 'roovert_conversations';
// Cap on how many trailing turns get persisted per conversation, so a very
// long conversation can't blow past localStorage's ~5-10MB quota.
const MAX_PERSISTED_TURNS = 50;
// Cap on how many conversations are kept around at all, so the list itself
// can't grow unboundedly - oldest (by last activity) are dropped first.
const MAX_CONVERSATIONS = 30;
// Where the response style pick (Normal/Concise/Explanatory/Formal) is
// persisted so it survives a reload, same as the conversation above.
const RESPONSE_STYLE_STORAGE_KEY = 'roovert_response_style';
// Where the response length pick (Short/Medium/Long) is persisted so it
// survives a reload, same pattern as the response style above.
const OUTPUT_LENGTH_STORAGE_KEY = 'roovert_output_length';
const DEFAULT_CONVERSATION_TITLE = 'New chat';
const MAX_CONVERSATION_TITLE_LENGTH = 40;

function generateConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (very old browsers) -
  // not cryptographically strong, but this is just a local list key, not a
  // security-sensitive identifier.
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Cheap, zero-dependency, zero-latency auto-title: clean up and truncate the
// first user message rather than making a separate LLM call for it. Keeps
// "first response arrives" instant instead of adding a round trip.
function deriveConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();
  if (!cleaned) return DEFAULT_CONVERSATION_TITLE;
  if (cleaned.length <= MAX_CONVERSATION_TITLE_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_CONVERSATION_TITLE_LENGTH).trimEnd()}…`;
}

// Best-effort localStorage write for the conversation list - never throws,
// matching the rest of this file's "persistence is a nice-to-have, not a
// requirement" stance on storage errors (quota exceeded, private browsing).
function persistConversations(conversations: Conversation[], activeConversationId: string) {
  try {
    if (conversations.length === 0) {
      localStorage.removeItem(CONVERSATIONS_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify({ conversations, activeConversationId })
    );
  } catch {
    // Quota exceeded or storage unavailable - persistence is best-effort and
    // must never crash the app.
  }
}

// Extended-thinking disclosure for reasoning-capable models (DeepSeek R1,
// Kimi K3). Collapsed/muted by default like the rest of the app's
// modal/panel disclosures; forced open via `isStreaming` while reasoning is
// arriving and no real answer text exists yet, so the user sees something
// happening instead of a dead silence during the "thinking" phase.
function ReasoningSection({
  text,
  isStreaming,
  expanded,
  onToggle,
}: {
  text: string;
  isStreaming: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isOpen = isStreaming || expanded;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        aria-expanded={isOpen}
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? '' : '-rotate-90'}`} />
        <span>{isStreaming ? 'Thinking…' : 'Thoughts'}</span>
        {isStreaming && (
          <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse ml-1" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted)] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const { isMobile } = useMobile();
  const [query, setQuery] = useState('');
  // Dictation into the composer via the browser's native Web Speech API -
  // a separate concern from the ambient useMicLevel() visualizer stream
  // above; see useSpeechToText.ts for why they don't share one mic session.
  const { isSupported: isDictationSupported, isListening: isDictating, start: startDictation, stop: stopDictation, error: dictationError } = useSpeechToText();
  // Text already in the composer when dictation starts, so interim/final
  // speech is appended after it rather than overwriting what was typed.
  const dictationPrefixRef = useRef('');
  const dictationFinalRef = useRef('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  // Extended-thinking text streamed live for reasoning-capable models
  // (DeepSeek R1, Kimi K3) before the real answer starts arriving. Cleared
  // once the turn is added to history (where it's persisted per-entry
  // instead, see `reasoning` on the history item below).
  const [reasoning, setReasoning] = useState<string | null>(null);
  // Manual expand override for the live in-progress turn's reasoning
  // section, used once the real answer has started (before that, it's
  // forced open regardless of this flag - see ReasoningSection).
  const [liveReasoningExpanded, setLiveReasoningExpanded] = useState(false);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  // Manual expand/collapse override for a past turn's reasoning section,
  // keyed by history index. Absent = default behavior (collapsed).
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  // The full conversation list (for the history panel) and which one
  // `history`/`isChatMode` above currently represent. `history`/`isChatMode`
  // stay the single source of truth the rest of this component already
  // reads/writes - switching conversations just swaps what they point at.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<number, 'up' | 'down'>>({});
  // Brief self-resetting "Copied" confirmation for the per-response copy
  // button - keyed by message index the same way messageFeedback is, since
  // multiple responses can each show their own copy state independently.
  const [copiedResponseIdx, setCopiedResponseIdx] = useState<number | null>(null);
  const copyResponseToClipboard = async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResponseIdx(idx);
      setTimeout(() => setCopiedResponseIdx((prev) => (prev === idx ? null : prev)), 2000);
    } catch (err) {
      console.error('Failed to copy response:', err);
    }
  };
  // Feedback state for the "Share Conversation" action in Settings - mirrors
  // the copiedCodeBlock pattern's brief self-resetting confirmation.
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // Whether a file is currently being dragged over the composer - drives the
  // drop-zone highlight; separate from selectedImage so the overlay never
  // lingers after a drop completes.
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  // Image generation mode - when on, the composer sends the prompt to
  // /api/huggingface-image instead of a chat model, and the result is a
  // generated image appended to history instead of streamed text.
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [hideImageGen, setHideImageGen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hideOpenRouterModels, setHideOpenRouterModels] = useState(false);
  const [hideHuggingFaceModels, setHideHuggingFaceModels] = useState(false);

  // Check OpenRouter/Hugging Face rate limits on mount and periodically -
  // same pattern for both: each provider's GET endpoint reports whether this
  // client has exhausted that provider's quota, so exhausted-provider models
  // hide from the picker instead of failing on click.
  useEffect(() => {
    const checkRateLimit = async (endpoint: string, setHidden: (hidden: boolean) => void) => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          return; // Skip if not JSON response
        }
        const data = await res.json();
        setHidden(data.shouldHide || false);
      } catch {
        // Silently handle errors - non-critical
      }
    };

    const checkAll = () => {
      checkRateLimit('/api/openrouter', setHideOpenRouterModels);
      checkRateLimit('/api/huggingface', setHideHuggingFaceModels);
      checkRateLimit('/api/huggingface-image', setHideImageGen);
    };

    checkAll();
    const interval = setInterval(checkAll, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Get available models (combine HUGGINGFACE_MODELS, MODELS, and
  // OPENROUTER_MODELS, filtering each provider's models out if that
  // provider's rate limit is currently exhausted). Hugging Face models are
  // listed first so they're the most visible entries in every model list
  // that renders off this array (composer dropdown, "Browse AI Models",
  // command palette).
  const availableModels = [
    ...(hideHuggingFaceModels ? [] : HUGGINGFACE_MODELS),
    ...MODELS,
    ...(hideOpenRouterModels ? [] : OPENROUTER_MODELS),
  ];

  // Default selection stays Multi-Perspective (the flagship feature) by id,
  // not by array position - the HF-first ordering above would otherwise
  // silently change which model a fresh visitor starts with.
  const [selectedModelId, setSelectedModelId] = useState(
    availableModels.find(m => m.id === 'multi-perspective')?.id || availableModels[0]?.id || MODELS[0].id
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Lifted out of SidebarRail so the main content area and composer bar can
  // shift their left offset in sync with the rail's expand/collapse width -
  // the rail is fixed-position, so it doesn't push sibling content on its
  // own and previously overlapped it once expanded.
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isLooksOpen, setIsLooksOpen] = useState(false);
  const [isGlobalFeedOpen, setIsGlobalFeedOpen] = useState(false);
  // Cmd/Ctrl+K quick-actions palette and its "?" shortcuts-help overlay -
  // both are plain client-side modals with no state beyond open/closed.
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [look, setLook] = useState('midnight');
  const [layout, setLayout] = useState('standard');
  const [fontSize, setFontSize] = useState('normal');
  const [dataSaver, setDataSaver] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  // Response style modifier (Normal/Concise/Explanatory/Formal) - composes
  // with, rather than replaces, the custom system prompt above. Lazily read
  // from localStorage since this only ever runs client-side (useState
  // initializers don't execute during SSR).
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(() => {
    if (typeof window === 'undefined') return 'normal';
    const saved = window.localStorage.getItem(RESPONSE_STYLE_STORAGE_KEY);
    return saved === 'concise' || saved === 'explanatory' || saved === 'formal' ? saved : 'normal';
  });
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closedWidgets, setClosedWidgets] = useState<Set<string>>(new Set());
  // Visualizer state - the app ships a full react-three-fiber background
  // visualizer + config panel; it previously had no way to ever be enabled
  // or opened (dead feature) and wasn't actually audio-reactive despite the
  // name (its "audioIntensity" was driven by mouse movement, unused). Now
  // reachable via the nav's Waves button, genuinely reacts to real audio via
  // the mic, and stays off by default since enabling it requests mic access.
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  // Gates whether the nav's Waves button (the only entry point to the
  // visualizer/config panel) renders at all. Off by default so the feature
  // is fully hidden from the landing page until explicitly turned on in
  // Settings; turning it back off also force-disables the visualizer itself
  // so it can't keep running with its only control gone.
  const [showVisualizerButton, setShowVisualizerButton] = useState(false);
  // Single shared mic stream for both the nav's pulsing indicator and the
  // 3D visualizer's particle motion - only requested while the visualizer
  // is actually on.
  const {
    level: micLevel, burst: micBurst, levelRef: micLevelRef,
    bandsRef: micBandsRef, burstRef: micBurstRef, status: micStatus,
  } = useMicLevel(visualizerEnabled);
  const [visualizerConfigOpen, setVisualizerConfigOpen] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('orb');
  const [visualizerSpeed, setVisualizerSpeed] = useState(0.3);
  const [visualizerColor1, setVisualizerColor1] = useState('#4a90e2');
  const [visualizerColor2, setVisualizerColor2] = useState('#7b68ee');
  const [visualizerDensity, setVisualizerDensity] = useState(0.5);
  const [visualizerInvertY, setVisualizerInvertY] = useState(false);
  const [visualizerScaleY, setVisualizerScaleY] = useState(true);
  // New wave form settings
  const [waveFormPreset, setWaveFormPreset] = useState<'default' | 'custom'>('default');
  const [waveFormDouble, setWaveFormDouble] = useState(false);
  const [maxAmplitude, setMaxAmplitude] = useState(1.36);
  const [waveFreq, setWaveFreq] = useState(2.0);
  // New general settings
  const [colorBackground, setColorBackground] = useState(false);
  const [colorsFollowMusic, setColorsFollowMusic] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(false);
  // Grid presets
  const [gridPreset, setGridPreset] = useState<'default' | 'bands' | 'custom'>('default');
  // Palette selection
  const [selectedPalette, setSelectedPalette] = useState(0);

  // Parallel orchestration - no UI control sets this, pinned at its default.
  const [runParallel] = useState(false);
  // Response length (Short/Medium/Long) - like responseStyle above, lazily
  // hydrated from localStorage since this only ever runs client-side.
  const [outputLength, setOutputLength] = useState<OutputLength>(() => {
    if (typeof window === 'undefined') return 'medium';
    const saved = window.localStorage.getItem(OUTPUT_LENGTH_STORAGE_KEY);
    return saved === 'small' || saved === 'large' ? saved : 'medium';
  });
  // Multi-Perspective's two combine slots may be Groq or Hugging Face
  // models - query-gateway/route.ts's parallel branch dispatches each leg
  // to whichever provider actually serves that model id. OpenRouter models
  // are deliberately excluded: that provider is only wired up as a single-
  // model passthrough (app/api/openrouter/route.ts), not into the combine
  // dispatch, so one here would silently mis-route.
  const combineModels = [
    ...MODELS.filter(m => m.id !== 'multi-perspective'),
    ...(hideHuggingFaceModels ? [] : HUGGINGFACE_MODELS),
  ];
  const [parallelModel1, setParallelModel1] = useState(combineModels[0]?.id || 'ooverta');
  const [parallelModel2, setParallelModel2] = useState(combineModels[1]?.id || 'llama-3.3-70b');
  // Live per-model text for an in-flight Multi-Perspective request, keyed by
  // model id (e.g. parallelModel1's value). Null when not in a
  // multi-perspective request.
  const [perspectiveResponses, setPerspectiveResponses] = useState<Record<string, string> | null>(null);
  // Which models (by id) in the current in-flight Multi-Perspective request
  // have individually finished streaming - drives the per-card loader.
  const [perspectiveDoneModels, setPerspectiveDoneModels] = useState<Set<string>>(new Set());

  // Default OFF - this used to render an always-on WebGL pointer-reactive
  // background (NeuralNoise.tsx) that was deleted when the R3F visualizer
  // was added, leaving this toggle in Settings doing nothing. Restored as an
  // explicit opt-in rather than its old always-on default, since two ambient
  // background effects competing by default would be visual clutter.
  const [neuralNoiseEnabled, setNeuralNoiseEnabled] = useState(false);
  // Track unavailable models (models that have failed recently)
  const [unavailableModels, setUnavailableModels] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  // Whether the history pane is scrolled at (or near) the bottom. Streaming
  // updates only auto-scroll while this stays true, so a user who scrolls up
  // to reread earlier content while a response is streaming in isn't yanked
  // back down on every chunk - only an explicit send re-pins to the bottom.
  const isPinnedToBottomRef = useRef(true);
  const NEAR_BOTTOM_THRESHOLD_PX = 120;

  const handleHistoryScroll = () => {
    const el = historyScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isPinnedToBottomRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
  };

  // Scrolls the anchor at the end of the history pane into view, but only if
  // the user is already near the bottom (or `force` is set, e.g. right after
  // sending a new message).
  const scrollToBottom = (force = false) => {
    if (!force && !isPinnedToBottomRef.current) return;
    setTimeout(() => {
      responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Auto-scroll to bottom when history or response changes
  useEffect(() => {
    if (isChatMode && (history.length > 0 || response)) {
      scrollToBottom();
    }
  }, [history.length, response, isChatMode]);

  // Composer auto-grow: the textarea grows with content up to a cap, then
  // scrolls internally. Measured with the scrollHeight-reset trick and
  // applied synchronously (useLayoutEffect) so the resize lands in the same
  // paint as the keystroke instead of flashing the old height first.
  const COMPOSER_MAX_HEIGHT_PX = 240;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [query]);

  // Whether we've finished attempting to restore a saved conversation from
  // localStorage. Gates the persist effect below so it doesn't fire (with
  // the initial empty state) before hydration runs and clobber a saved
  // conversation on the very first render.
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount. Deliberately done in an effect
  // (client-only, runs after the initial render) rather than in a useState
  // lazy initializer - localStorage doesn't exist during SSR, and reading it
  // synchronously during render would make the server-rendered HTML (always
  // empty/landing state) mismatch what the client renders on hydration. The
  // tradeoff is a one-frame flash from empty to restored, which is fine here.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.conversations) && parsed.conversations.length > 0) {
          const restored: Conversation[] = parsed.conversations;
          const activeId = typeof parsed.activeConversationId === 'string'
            && restored.some((c) => c.id === parsed.activeConversationId)
            ? parsed.activeConversationId
            : restored[0].id;
          const active = restored.find((c) => c.id === activeId) ?? restored[0];
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount; can't run during SSR/render, so an effect is the only option
          setConversations(restored);
          setActiveConversationId(activeId);
          setHistory(active.history);
          setIsChatMode(active.isChatMode);
          return;
        }
      }

      // Nothing under the new key yet - check for a conversation saved under
      // the old single-slot key (pre-multi-conversation-history) and migrate
      // it in, rather than silently discarding an existing user's chat.
      const legacy = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      let migratedId: string | null = null;
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (parsedLegacy && Array.isArray(parsedLegacy.history)
          && (parsedLegacy.history.length > 0 || parsedLegacy.isChatMode)) {
          const now = Date.now();
          const migrated: Conversation = {
            id: generateConversationId(),
            title: deriveConversationTitle(parsedLegacy.history[0]?.query ?? ''),
            titleIsCustom: false,
            history: parsedLegacy.history,
            isChatMode: !!parsedLegacy.isChatMode,
            createdAt: now,
            updatedAt: now,
          };
          setConversations([migrated]);
          setActiveConversationId(migrated.id);
          setHistory(migrated.history);
          setIsChatMode(migrated.isChatMode);
          persistConversations([migrated], migrated.id);
          migratedId = migrated.id;
        }
        localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      }
      if (!migratedId) {
        setActiveConversationId(generateConversationId());
      }
    } catch {
      // Corrupt/unparseable saved data - ignore it and start fresh instead
      // of crashing the app.
      setActiveConversationId(generateConversationId());
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist history + isChatMode into the active conversation whenever they
  // change, so a refresh or crash doesn't lose it. `conversations` is
  // intentionally read via closure rather than listed as a dependency - it's
  // only ever updated by this same effect, so depending on it would just
  // make it re-run redundantly on its own writes.
  useEffect(() => {
    if (!isHydrated || !activeConversationId) return; // avoid overwriting saved data before we've restored it
    const existing = conversations.find((c) => c.id === activeConversationId);

    if (history.length === 0 && !isChatMode) {
      if (!existing) return; // this conversation never had content - nothing to remove
      const next = conversations.filter((c) => c.id !== activeConversationId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the in-memory conversation list with what was just written to localStorage, the same external-system-sync case the hydration effect above is exempted for
      setConversations(next);
      persistConversations(next, activeConversationId);
      return;
    }

    // Only keep the last MAX_PERSISTED_TURNS turns, and drop each turn's
    // (often large, base64-encoded) `image` field before persisting - images
    // are usually the biggest payload and the least essential thing to
    // restore, so stripping them keeps us well under localStorage's
    // ~5-10MB quota even for long or image-heavy chats.
    const trimmedHistory: PersistedHistoryTurn[] = history
      .slice(-MAX_PERSISTED_TURNS)
      .map(({ query, response, model, perspectives, reasoning }) => ({ query, response, model, perspectives, reasoning }));
    const now = Date.now();
    const title = existing?.titleIsCustom
      ? existing.title
      : deriveConversationTitle(history[0]?.query ?? '');
    const nextEntry: Conversation = {
      id: activeConversationId,
      title,
      titleIsCustom: existing?.titleIsCustom ?? false,
      history: trimmedHistory,
      isChatMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    let next = [nextEntry, ...conversations.filter((c) => c.id !== activeConversationId)]
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (next.length > MAX_CONVERSATIONS) {
      // nextEntry always sorts first (it just got `now` as updatedAt), so
      // the active conversation is never the one dropped here.
      next = next.slice(0, MAX_CONVERSATIONS);
    }
    setConversations(next);
    persistConversations(next, activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `conversations` deliberately omitted, see comment above
  }, [history, isChatMode, isHydrated, activeConversationId]);

  // Persist the response style choice whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(RESPONSE_STYLE_STORAGE_KEY, responseStyle);
    } catch {
      // Storage unavailable (e.g. private browsing) - persistence is
      // best-effort and must never crash the app.
    }
  }, [responseStyle]);

  // Persist the response length choice whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(OUTPUT_LENGTH_STORAGE_KEY, outputLength);
    } catch {
      // Storage unavailable (e.g. private browsing) - persistence is
      // best-effort and must never crash the app.
    }
  }, [outputLength]);

  // Combines the custom system prompt with the active response style's and
  // response length's instructions (if any) into the single string sent to
  // the backend. Returns undefined when none are set, so the API route
  // falls back to its own default base prompt exactly as before this
  // feature existed.
  const buildEffectiveSystemPrompt = () => {
    const styleInstruction = getStyleInstruction(responseStyle);
    const lengthInstruction = getLengthInstruction(outputLength);
    if (!systemPrompt && !styleInstruction && !lengthInstruction) return undefined;
    return getSystemPrompt(systemPrompt || undefined, styleInstruction, lengthInstruction);
  };

  // Clears the current conversation and returns to the landing view. Used by
  // the explicit "New Chat" control and by the nav actions that end the
  // current session - both previously only flipped isChatMode back to false
  // while leaving the old history in memory (and in localStorage) underneath,
  // so it would silently reappear on the next message or reload.
  const startNewChat = () => {
    setHistory([]);
    setResponse(null);
    setQuery('');
    setSelectedImage(null);
    setIsChatMode(false);
    setActiveConversationId(generateConversationId());
    setMessageFeedback({});
    setExpandedReasoning({});
    setCopiedResponseIdx(null);
  };

  // Switches `history`/`isChatMode` to point at a different, already-known
  // conversation. The one being left is already fully persisted (every
  // history/isChatMode change flows through the persist effect above), so
  // there's nothing extra to save on the way out.
  const switchConversation = (id: string) => {
    if (id === activeConversationId) {
      setIsHistoryOpen(false);
      return;
    }
    const target = conversations.find((c) => c.id === id);
    if (!target) return;
    abortController?.abort();
    setAbortController(null);
    setIsProcessing(false);
    setActiveConversationId(id);
    setHistory(target.history);
    setIsChatMode(target.isChatMode);
    setResponse(null);
    setQuery('');
    setSelectedImage(null);
    setIsHistoryOpen(false);
    setMessageFeedback({});
    setExpandedReasoning({});
    setCopiedResponseIdx(null);
  };

  const renameConversation = (id: string, rawTitle: string) => {
    const title = rawTitle.trim().slice(0, MAX_CONVERSATION_TITLE_LENGTH) || DEFAULT_CONVERSATION_TITLE;
    const next = conversations.map((c) => (c.id === id ? { ...c, title, titleIsCustom: true } : c));
    setConversations(next);
    persistConversations(next, activeConversationId);
  };

  const deleteConversation = (id: string) => {
    const next = conversations.filter((c) => c.id !== id);
    setConversations(next);
    if (id !== activeConversationId) {
      persistConversations(next, activeConversationId);
      return;
    }
    // Deleted the active conversation - fall back to the next most recent
    // one, or a fresh empty conversation if that was the last one.
    const fallback = next[0];
    setResponse(null);
    setQuery('');
    setSelectedImage(null);
    setMessageFeedback({});
    setExpandedReasoning({});
    setCopiedResponseIdx(null);
    if (fallback) {
      setActiveConversationId(fallback.id);
      setHistory(fallback.history);
      setIsChatMode(fallback.isChatMode);
      persistConversations(next, fallback.id);
    } else {
      const newId = generateConversationId();
      setActiveConversationId(newId);
      setHistory([]);
      setIsChatMode(false);
      persistConversations(next, newId);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleWidget = (widgetId: string) => {
    setClosedWidgets(prev => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  };

  // Apply Look & Layout
  useEffect(() => {
    document.documentElement.setAttribute('data-look', look);
    document.documentElement.setAttribute('data-theme', look); // Keep for backward compatibility
    document.documentElement.setAttribute('data-layout', layout);
    document.documentElement.setAttribute('data-speed', dataSaver ? 'none' : 'normal');
    document.documentElement.setAttribute('data-size', fontSize);

    if (dataSaver) {
      document.documentElement.classList.add('data-saver');
    } else {
      document.documentElement.classList.remove('data-saver');
    }
  }, [look, layout, fontSize, dataSaver]);

  // Filter out unavailable models (use the combined list from above)
  const filteredAvailableModels = availableModels.filter(m => !unavailableModels.has(m.id));
  const selectedModel = filteredAvailableModels.find(m => m.id === selectedModelId) || filteredAvailableModels[0];

  // If selected model becomes unavailable, switch to first available.
  // Deferred (not a synchronous setState-in-effect) so React doesn't
  // cascade a render while this effect is still committing - same pattern
  // used in app/hooks/useMicLevel.ts for the same lint rule.
  useEffect(() => {
    if (selectedModelId && unavailableModels.has(selectedModelId)) {
      if (filteredAvailableModels.length > 0) {
        const fallbackId = filteredAvailableModels[0].id;
        queueMicrotask(() => setSelectedModelId(fallbackId));
      }
    }
  }, [unavailableModels, selectedModelId, filteredAvailableModels]);

  // Check if image upload should be disabled
  // Disable if:
  // 1. Selected model is unavailable (would cause provider errors)
  // 2. No API key configured (would cause "local inference mode" errors)
  const isImageUploadDisabled = !selectedModel || unavailableModels.has(selectedModelId);
  const imageUploadDisabledReason = !selectedModel
    ? 'No model selected'
    : unavailableModels.has(selectedModelId)
      ? 'Model temporarily unavailable'
      : '';

  const injectPrompt = (prompt: string) => {
    setIsChatMode(true); // Enter Chat Mode
    setQuery(prompt);
    setResponse(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // Global Feed renders inline at the top of #main-content (not a modal),
  // so opening it while scrolled down anywhere else on the page - "Browse
  // AI Models", "Built With Itself", etc. - left it rendering off-screen
  // above the viewport with no indication anything happened. Scrolling the
  // scroll container (main, not window - it owns its own overflow-y-auto)
  // back to top whenever it opens keeps the panel where the user can see it.
  const openGlobalFeed = () => {
    setIsGlobalFeedOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  // "Ask about this" on a Global Feed story - reuses the same
  // enter-chat-mode-and-prefill pattern as the homepage's QUICK_PROMPTS
  // buttons, then closes the feed panel since its job (picking a topic) is
  // done and it would otherwise sit above the chat the user just started.
  const askAboutStory = (story: { title: string; url?: string }) => {
    injectPrompt(
      story.url
        ? `Tell me more about this story: "${story.title}" (${story.url})`
        : `Tell me more about this story: "${story.title}"`
    );
    setIsGlobalFeedOpen(false);
  };

  const handleMessageFeedback = (messageIdx: number, rating: 'up' | 'down', modelId: string) => {
    const nextRating = messageFeedback[messageIdx] === rating ? undefined : rating;

    setMessageFeedback(prev => {
      const next = { ...prev };
      if (nextRating) {
        next[messageIdx] = nextRating;
      } else {
        delete next[messageIdx];
      }
      return next;
    });

    if (!nextRating) return; // Toggled off - no need to log a retraction

    // Fire-and-forget: feedback logging should never block or disrupt the UI
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: nextRating, modelId: modelId || 'unknown' }),
    }).catch(() => {
      // Silently fail - feedback logging is not critical
    });
  };

  const handleInitialize = async () => {
    // Track "Initialize Chat" click
    try {
      await fetch('/api/track-initialize', { method: 'POST' });
    } catch {
      // Silently fail - tracking is not critical
    }

    setIsChatMode(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // iOS Safari (the dominant mobile browser on the one platform where this
  // app has no alternative rendering engine) has no Fullscreen API support -
  // document.fullscreenEnabled is false there. Without this check the button
  // below rendered unconditionally and just silently did nothing when
  // tapped, unlike every other unsupported-feature control in this file
  // (dictation, image-gen) which hide themselves instead of looking broken.
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  useEffect(() => {
    setIsFullscreenSupported(typeof document !== 'undefined' && !!document.fullscreenEnabled);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  };

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleExportChat = () => {
    const text = history.map(h => {
      if (h.perspectives && h.perspectives.length > 0) {
        const perspectivesText = h.perspectives
          .map(p => `  [${availableModels.find(m => m.id === p.model)?.name || p.model}]: ${p.content}`)
          .join('\n');
        return `User: ${h.query}\nAI (Multi-Perspective):\n${perspectivesText}\n\n`;
      }
      return `User: ${h.query}\nAI (${h.model}): ${h.response}\n\n`;
    }).join('---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roovert-chat-${new Date().toISOString()}.txt`;
    a.click();
  };

  // Posts the current conversation to /api/share and copies the resulting
  // /share/{id} link to the clipboard - mirrors the copy-to-clipboard
  // confirmation pattern used by code blocks (copiedCodeBlock in
  // MarkdownMessage): a brief "copied" state that self-resets.
  const handleShareConversation = async () => {
    if (history.length === 0) {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2000);
      return;
    }

    setShareStatus('sharing');
    try {
      // Flatten each turn into the {role, content} shape validateConversationHistory
      // expects (same shape query-gateway sends to the model) - Multi-Perspective
      // turns are collapsed into one assistant message per model so the shared
      // view can still show every perspective.
      const conversationHistory = history.flatMap((h) => {
        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
          { role: 'user', content: h.query },
        ];
        if (h.perspectives && h.perspectives.length > 0) {
          const combined = h.perspectives
            .map((p) => `[${availableModels.find((m) => m.id === p.model)?.name || p.model}]\n${p.content}`)
            .join('\n\n');
          messages.push({ role: 'assistant', content: combined });
        } else if (h.response) {
          messages.push({ role: 'assistant', content: h.response });
        }
        return messages;
      });

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationHistory }),
      });

      if (!res.ok) {
        throw new Error('Share request failed');
      }

      const data = await res.json();
      const shareUrl = `${window.location.origin}${data.url}`;
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('copied');
    } catch (err) {
      console.error('Failed to create share link:', err);
      setShareStatus('error');
    } finally {
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsProcessing(false);
    }
  };

  // Image compression utility
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 2048px on longest side, maintain aspect ratio)
          const MAX_DIMENSION = 2048;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIMENSION) {
            height = (height * MAX_DIMENSION) / width;
            width = MAX_DIMENSION;
          } else if (height > MAX_DIMENSION) {
            width = (width * MAX_DIMENSION) / height;
            height = MAX_DIMENSION;
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Draw image with high quality scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression (quality 0.85 for good balance)
          const quality = 0.85;
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

          // Check if compressed size is still too large (> 4MB base64 = ~3MB actual)
          // Base64 is ~33% larger than binary, so 4MB base64 ≈ 3MB binary
          if (compressedBase64.length > 4 * 1024 * 1024) {
            // Try again with lower quality
            const lowerQuality = 0.7;
            const moreCompressed = canvas.toDataURL('image/jpeg', lowerQuality);
            resolve(moreCompressed);
          } else {
            resolve(compressedBase64);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Shared image-attach pipeline: validates a File the same way regardless of
  // how it arrived (click-to-attach, paste, or drag-and-drop) and, if valid,
  // compresses it and sets it as the attached image. Returns true if the
  // file was accepted so callers (e.g. paste/drop handlers) know whether to
  // suppress their default browser behavior.
  const attachImageFile = async (file: File): Promise<boolean> => {
    // Prevent upload if disabled (model unavailable or API key missing)
    if (isImageUploadDisabled) {
      setStatusNote(`Image upload is disabled: ${imageUploadDisabledReason}. Please select an available model.`);
      setTimeout(() => setStatusNote(null), 5000);
      return false;
    }

    // Security: Validate file extension (MIME type can be spoofed)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please select a JPG, PNG, GIF, or WebP image.');
      return false;
    }

    // Validate file type (MIME type check)
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return false;
    }

    // Validate file size (max 20MB before compression)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      alert('Image size must be less than 20MB. Large images will be automatically compressed.');
      return false;
    }

    try {
      // Compress image before converting to base64
      const compressedBase64 = await compressImage(file);
      setSelectedImage(compressedBase64);
    } catch (error) {
      console.error('Image compression error:', error);
      alert('Failed to process image. Please try a different image.');
      // Fallback to original if compression fails
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
      };
      reader.readAsDataURL(file);
    }
    return true;
  };

  // Image upload handler (click-to-attach via the hidden file input)
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const accepted = await attachImageFile(file);
    if (!accepted) {
      event.target.value = ''; // Clear the input so re-selecting the same file re-fires onChange
    }
  };

  // Paste-to-attach: only intercepts when the clipboard actually contains an
  // image file, so normal text paste is completely unaffected.
  const handleComposerPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isImageGenMode) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageItem = Array.from(items).find(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    void attachImageFile(file);
  };

  // Drag-and-drop: desktop-only by nature. Tracks drag state so the drop
  // zone highlight only shows while a file is actively being dragged over
  // the composer.
  const handleComposerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isImageGenMode || isImageUploadDisabled) return;
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    setIsDraggingImage(true);
  };

  const handleComposerDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    // Ignore leave events bubbling from child elements while still inside the composer
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingImage(false);
  };

  const handleComposerDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setIsDraggingImage(false);
    // Prevent the browser's default "navigate to dropped file" behavior for
    // any file drop, even ones we ultimately reject as non-image.
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
    }
    if (isImageGenMode) return;
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    void attachImageFile(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || isProcessing) {
      return;
    }

    setIsChatMode(true);
    setIsProcessing(true);
    setResponse('');
    setReasoning(null);
    setLiveReasoningExpanded(false);
    setPerspectiveResponses(null);
    setPerspectiveDoneModels(new Set());
    setStatusNote(null);
    // Sending always re-pins the view to the bottom, even if the user had
    // scrolled up to reread earlier messages.
    isPinnedToBottomRef.current = true;

    // Create abort controller for streaming
    const controller = new AbortController();
    setAbortController(controller);

    // Image generation - a fully separate, non-streaming request/response
    // shape (JSON in, base64 image out) rather than the SSE chat protocol
    // every other model here uses, so it's handled as its own short-circuit
    // path instead of being squeezed into the streaming logic below.
    if (isImageGenMode) {
      try {
        const res = await fetch('/api/huggingface-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmedQuery }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || typeof data.image !== 'string') {
          setStatusNote(typeof data.error === 'string' ? data.error : 'Failed to generate image. Please try again.');
          setIsProcessing(false);
          setAbortController(null);
          return;
        }

        setHistory(prev => [
          ...prev,
          { query: trimmedQuery, response: '', model: 'hf-image-gen', generatedImage: data.image },
        ]);
        setQuery('');
        setIsProcessing(false);
        setAbortController(null);
        scrollToBottom(true);
      } catch (caughtError) {
        const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
        if (error.name !== 'AbortError') {
          console.error('Image generation error:', error);
          setStatusNote('Failed to generate image. Please try again.');
        }
        setIsProcessing(false);
        setAbortController(null);
      }
      return;
    }

    try {
      // Build conversation history in the format expected by the API
      // Preserve image data in history
      const conversationHistory = history.map(h => {
        const content: ChatContent = h.image
          ? [
            { type: 'text', text: h.query },
            { type: 'image_url', image_url: { url: h.image } },
          ]
          : h.query;

        return [
          { role: 'user' as const, content },
          { role: 'assistant' as const, content: h.response },
        ];
      }).flat();

      // Determine if this is an OpenRouter model
      const isOpenRouterModel = OPENROUTER_MODELS.some(m => m.id === selectedModel.id);
      const isHuggingFaceModel = HUGGINGFACE_MODELS.some(m => m.id === selectedModel.id);
      const apiEndpoint = isOpenRouterModel
        ? '/api/openrouter'
        : isHuggingFaceModel
          ? '/api/huggingface'
          : '/api/query-gateway';

      // Automatically enable parallel mode if Multi-Perspective is selected
      const isMultiPerspective = selectedModel.id === 'multi-perspective';
      const actualRunParallel = isMultiPerspective || runParallel;
      const activeParallelModel1 = parallelModel1 || 'llama-3.3-70b';
      const activeParallelModel2 = parallelModel2 || 'ooverta';

      if (actualRunParallel) {
        // Seed both models' live buffers so the comparison cards render
        // immediately with their loaders, before the first chunk arrives.
        setPerspectiveResponses({
          [activeParallelModel1]: '',
          [activeParallelModel2]: '',
        });
      }

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          image: selectedImage || undefined,
          model: selectedModel.id, // Send model ID, not API ID (backend maps it)
          systemPrompt: buildEffectiveSystemPrompt(),
          conversationHistory: conversationHistory,
          runParallel: actualRunParallel,
          outputLength: outputLength,
          parallelModel1: actualRunParallel ? activeParallelModel1 : undefined,
          parallelModel2: actualRunParallel ? activeParallelModel2 : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 413) {
          setStatusNote('Image is too large. Please try a smaller image or compress it before uploading.');
          setIsProcessing(false);
          setAbortController(null);
          return;
        }
        const errorText = await res.text().catch(() => 'Unknown error');
        throw new Error(`HTTP error! status: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let fullResponse = '';
      let fullReasoning = '';
      // Multi-perspective bookkeeping: local mirror of perspectiveResponses
      // (state updates are async, so we need a synchronous accumulator) plus
      // which models have individually reported `done`.
      const perspectiveText: Record<string, string> = {
        [activeParallelModel1]: '',
        [activeParallelModel2]: '',
      };
      const perspectiveDone = new Set<string>();

      const flagPossibleModelError = (content: string, modelId: string = selectedModelId) => {
        if (
          content.includes('Provider Error') ||
          content.includes('rate limit') ||
          content.includes('quota') ||
          content.includes('limit exceeded') ||
          content.includes('Systems Notice') ||
          content.includes('Provider returned error')
        ) {
          // Mark model as unavailable temporarily (for 5 minutes)
          setUnavailableModels(prev => new Set(prev).add(modelId));
          setTimeout(() => {
            setUnavailableModels(prev => {
              const next = new Set(prev);
              next.delete(modelId);
              return next;
            });
          }, 5 * 60 * 1000); // 5 minutes
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (actualRunParallel) {
              // Multiplexed protocol: each chunk is tagged with which model
              // it belongs to. A `done` with no `model` field means BOTH
              // models have finished and the whole exchange is complete.
              if (data.model) {
                if (typeof data.content === 'string' && data.content) {
                  perspectiveText[data.model] = (perspectiveText[data.model] || '') + data.content;
                  flagPossibleModelError(data.content, data.model);
                }
                if (data.done) {
                  perspectiveDone.add(data.model);
                  setPerspectiveDoneModels(new Set(perspectiveDone));
                }
                setPerspectiveResponses({ ...perspectiveText });

                scrollToBottom();
                continue;
              }

              if (data.done) {
                setIsProcessing(false);
                setAbortController(null);
                setHistory(prev => [
                  ...prev,
                  {
                    query: trimmedQuery,
                    response: [activeParallelModel1, activeParallelModel2]
                      .map(m => `[${m}] ${perspectiveText[m] || ''}`)
                      .join('\n\n'),
                    model: selectedModelId,
                    image: selectedImage || undefined,
                    perspectives: [activeParallelModel1, activeParallelModel2].map(m => ({
                      model: m,
                      content: perspectiveText[m] || '',
                    })),
                  },
                ]);
                setPerspectiveResponses(null);
                setPerspectiveDoneModels(new Set());
                setQuery('');
                setSelectedImage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                scrollToBottom();
                return;
              }
              continue;
            }

            if (typeof data.reasoning === 'string' && data.reasoning) {
              fullReasoning += data.reasoning;
              setReasoning(fullReasoning);

              // Auto-scroll to bottom
              setTimeout(() => {
                responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
            if (data.content) {
              fullResponse += data.content;
              setResponse(fullResponse);
              flagPossibleModelError(data.content);

              // Auto-scroll to bottom (only if the user hasn't scrolled up)
              scrollToBottom();
            }
            if (data.done) {
              setIsProcessing(false);
              setAbortController(null);
              setHistory(prev => [
                ...prev,
                {
                  query: trimmedQuery,
                  response: fullResponse,
                  model: selectedModelId,
                  image: selectedImage || undefined,
                  reasoning: fullReasoning || undefined,
                },
              ]);
              setResponse(null); // Clear current response after adding to history
              setReasoning(null);
              setQuery('');
              setSelectedImage(null); // Clear image after sending
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              // Auto-scroll to bottom after adding to history
              scrollToBottom();
              return;
            }
          } catch {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (caughtError) {
      const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      if (error.name === 'AbortError') {
        // User cancelled, keep current response - silently handle
        setIsProcessing(false);
        setAbortController(null);
        return;
      }
      // Suppress media playback errors (from browser extensions or third-party scripts)
      if (error.name === 'NotAllowedError' ||
        (error.message && (
          error.message.includes('play()') ||
          error.message.includes('pause()') ||
          error.message.includes('interrupted') ||
          error.message.includes('playback')
        ))) {
        return; // Silently ignore media playback errors
      }
      // Handle 413 Payload Too Large errors
      if (error.message && error.message.includes('413')) {
        setStatusNote('Image is too large. The image has been compressed, but it may still be too large. Please try a smaller image.');
        setIsProcessing(false);
        setAbortController(null);
        return;
      }
      console.error('Query failed:', error);
      const fallbackMessage = error?.message || 'Upstream unavailable.';

      // Check if error indicates model is unavailable (provider error, rate limit, etc.)
      if (error.message && (
        error.message.includes('Provider Error') ||
        error.message.includes('rate limit') ||
        error.message.includes('quota') ||
        error.message.includes('limit exceeded') ||
        error.message.includes('unavailable')
      )) {
        // Mark this model as unavailable temporarily (for 5 minutes)
        setUnavailableModels(prev => new Set(prev).add(selectedModelId));

        // Model availability tracking endpoint removed

        // Remove from unavailable list after 5 minutes
        setTimeout(() => {
          setUnavailableModels(prev => {
            const next = new Set(prev);
            next.delete(selectedModelId);
            return next;
          });
        }, 5 * 60 * 1000); // 5 minutes
      }

      setResponse(`System notice: ${fallbackMessage}`);
      setStatusNote('Simulation mode engaged — verify environment keys.');
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    // Whether the key event originated in a text input/textarea/contentEditable
    // element - guards single-character shortcuts (like "?") so they don't
    // hijack normal typing. Modifier-combo shortcuts (Cmd+K etc.) don't need
    // this: holding Cmd/Ctrl means no character is actually being typed.
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isProcessing && query.trim()) {
          handleSubmit(e);
        }
        return;
      }
      // Escape to stop
      if (e.key === 'Escape' && isProcessing) {
        handleStop();
        return;
      }
      // Cmd/Ctrl + K - open the quick-actions command palette
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }
      // Cmd/Ctrl + Shift + O - start a new chat (matches Claude.ai; avoids
      // Cmd+N, which browsers/OSes reserve for "new window")
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        startNewChat();
        return;
      }
      // Cmd/Ctrl + , - open settings (standard app-preferences convention)
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }
      // ? - open the shortcuts help overlay, but only outside of text input
      // (so typing a literal "?" in the composer or a search box works normally)
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handleSubmit/handleStop/startNewChat intentionally omitted: they're
    // recreated every render (not memoized) and this effect already
    // re-subscribes on every query/isProcessing change, so including them
    // would add churn with no behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isProcessing]);

  // Small 3-dot "thinking" indicator, reused for both the single-model
  // "processing" state and each Multi-Perspective card while that model is
  // still streaming. Dots fade in a gentle stagger (opacity only) rather
  // than bounce, for a calmer, more understated feel. A plain element (not
  // a component defined at render-time) so it's safe to reuse across
  // multiple spots in the JSX below.
  //
  // Note: the shared `code`-block-copy renderer that used to live here
  // (`markdownComponents`) moved into `MarkdownMessage.tsx`, reused by both
  // this page and the read-only share view - see that file instead.
  const thinkingIndicator = (
    <div className="flex space-x-1 h-6 items-center">
      <div className="thinking-dot w-2 h-2 bg-[var(--foreground)]/40 rounded-full [animation-delay:-0.32s]"></div>
      <div className="thinking-dot w-2 h-2 bg-[var(--foreground)]/40 rounded-full [animation-delay:-0.16s]"></div>
      <div className="thinking-dot w-2 h-2 bg-[var(--foreground)]/40 rounded-full"></div>
    </div>
  );

  // Command palette actions - each wired directly to a handler/setter that
  // already exists above rather than inventing new behavior, so the palette
  // is just another entry point into things the UI can already do.
  const commandActions: CommandAction[] = [
    {
      id: 'new-chat',
      label: 'New Chat',
      category: 'Actions',
      icon: <MessageSquarePlus className="w-4 h-4" />,
      keywords: 'clear reset conversation',
      onSelect: startNewChat,
    },
    {
      id: 'open-history',
      label: 'Conversation History',
      category: 'Actions',
      icon: <History className="w-4 h-4" />,
      keywords: 'past chats switch rename delete',
      onSelect: () => setIsHistoryOpen(true),
    },
    {
      id: 'open-settings',
      label: 'Open Settings',
      category: 'Actions',
      icon: <Settings className="w-4 h-4" />,
      onSelect: () => setIsSettingsOpen(true),
    },
    {
      id: 'change-theme',
      label: 'Change Theme / Look',
      category: 'Actions',
      icon: <Paintbrush className="w-4 h-4" />,
      keywords: 'looks appearance style',
      onSelect: () => setIsLooksOpen(true),
    },
    {
      id: 'open-global-feed',
      label: 'Open Global Feed',
      category: 'Actions',
      icon: <Globe className="w-4 h-4" />,
      onSelect: () => openGlobalFeed(),
    },
    {
      id: 'export-chat',
      label: 'Export Conversation',
      category: 'Actions',
      icon: <Download className="w-4 h-4" />,
      keywords: 'download save transcript',
      onSelect: handleExportChat,
    },
    {
      id: 'toggle-focus-mode',
      label: focusMode ? 'Turn Off Focus Mode' : 'Turn On Focus Mode',
      category: 'Actions',
      icon: <Focus className="w-4 h-4" />,
      keywords: 'distraction free zen',
      onSelect: () => setFocusMode(prev => !prev),
    },
    {
      id: 'shortcuts-help',
      label: 'Show Keyboard Shortcuts',
      category: 'Actions',
      icon: <Keyboard className="w-4 h-4" />,
      keywords: 'help hotkeys',
      onSelect: () => setIsShortcutsHelpOpen(true),
    },
    ...filteredAvailableModels.map((m): CommandAction => ({
      id: `model-${m.id}`,
      label: m.id === selectedModelId ? `${m.name} (current)` : `Switch to ${m.name}`,
      category: 'Models',
      icon: <Cpu className="w-4 h-4" />,
      keywords: m.category,
      onSelect: () => setSelectedModelId(m.id),
    })),
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500 flex flex-col">
      {/* Neural Noise - opt-in ambient WebGL background (pointer-reactive),
          independent of and layered beneath the R3F audio visualizer. Off by
          default; see the neuralNoiseEnabled state declaration for why. */}
      {neuralNoiseEnabled && (
        <NeuralNoise isChatMode={isChatMode} currentLook={look} />
      )}

      {/* R3F Visualizer */}
      {visualizerEnabled && (
        <R3FVisualizer
          mode={visualizerMode}
          speed={visualizerSpeed}
          color1={visualizerColor1}
          color2={visualizerColor2}
          density={visualizerDensity}
          invertY={visualizerInvertY}
          scaleY={visualizerScaleY}
          maxAmplitude={maxAmplitude}
          waveFreq={waveFreq}
          waveFormDouble={waveFormDouble}
          autoOrbit={autoOrbit}
          colorsFollowMusic={colorsFollowMusic}
          audioLevelRef={micLevelRef}
          audioBandsRef={micBandsRef}
          audioBurstRef={micBurstRef}
        />
      )}

      {/* Visualizer Configuration Panel */}
      <VisualizerConfigPanel
        isOpen={visualizerConfigOpen}
        onClose={() => setVisualizerConfigOpen(false)}
        enabled={visualizerEnabled}
        onEnabledChange={setVisualizerEnabled}
        micStatus={micStatus}
        mode={visualizerMode}
        onModeChange={setVisualizerMode}
        onColor1Change={setVisualizerColor1}
        onColor2Change={setVisualizerColor2}
        waveFormPreset={waveFormPreset}
        onWaveFormPresetChange={setWaveFormPreset}
        waveFormDouble={waveFormDouble}
        onWaveFormDoubleChange={setWaveFormDouble}
        maxAmplitude={maxAmplitude}
        onMaxAmplitudeChange={setMaxAmplitude}
        waveFreq={waveFreq}
        onWaveFreqChange={setWaveFreq}
        colorBackground={colorBackground}
        onColorBackgroundChange={setColorBackground}
        colorsFollowMusic={colorsFollowMusic}
        onColorsFollowMusicChange={setColorsFollowMusic}
        autoOrbit={autoOrbit}
        onAutoOrbitChange={setAutoOrbit}
        gridPreset={gridPreset}
        onGridPresetChange={setGridPreset}
        selectedPalette={selectedPalette}
        onSelectedPaletteChange={setSelectedPalette}
        onReset={() => {
          setVisualizerMode('orb');
          setVisualizerSpeed(0.3);
          setVisualizerColor1('#ff6b35');
          setVisualizerColor2('#00d4ff');
          setVisualizerDensity(0.5);
          setVisualizerInvertY(false);
          setVisualizerScaleY(true);
          setWaveFormPreset('default');
          setWaveFormDouble(false);
          setMaxAmplitude(1.36);
          setWaveFreq(2.0);
          setColorBackground(false);
          setColorsFollowMusic(false);
          setAutoOrbit(false);
          setGridPreset('default');
          setSelectedPalette(0);
        }}
      />

      {/* Navigation - a slim desktop icon rail (SidebarRail) replacing the
          old top nav bar, a hamburger-triggered slide-over covering the
          same actions on mobile (MobileNav), and a small top-right strip
          for the handful of widgets that don't read as icons (clock,
          visitor count, Mission/Careers links). focusMode's old
          hover-to-reveal behavior is preserved on the two chrome layers. */}
      <div
        className={`transition-opacity duration-[var(--duration-base)] ${focusMode && !isMobile ? 'opacity-0 hover:opacity-100 [&_*]:pointer-events-none hover:[&_*]:pointer-events-auto' : 'opacity-100'}`}
      >
        <SidebarRail
          isChatMode={isChatMode}
          expanded={isSidebarExpanded}
          onExpandedChange={setIsSidebarExpanded}
          onNewChat={startNewChat}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenGlobalFeed={() => openGlobalFeed()}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenLooks={() => setIsLooksOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          showVisualizerButton={showVisualizerButton}
          visualizerEnabled={visualizerEnabled}
          onToggleVisualizer={() => {
            // Single click both toggles the visualizer directly (this
            // control visually reads as a toggle, so it needs to behave
            // like one) and opens the settings panel so mode/color options
            // stay reachable - same behavior the old nav button had.
            setVisualizerEnabled(!visualizerEnabled);
            setVisualizerConfigOpen(true);
          }}
          micStatus={micStatus}
          micLevel={micLevel}
          micBurst={micBurst}
        />
        <MobileNav
          isChatMode={isChatMode}
          onNewChat={startNewChat}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenGlobalFeed={() => openGlobalFeed()}
          onOpenLooks={() => setIsLooksOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          showVisualizerButton={showVisualizerButton}
          visualizerEnabled={visualizerEnabled}
          onToggleVisualizer={() => {
            setVisualizerEnabled(!visualizerEnabled);
            setVisualizerConfigOpen(true);
          }}
        />
        <TopStrip isChatMode={isChatMode} focusMode={focusMode} isMobile={isMobile} />
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentModelId={selectedModelId}
            setModelId={setSelectedModelId}
            layout={layout}
            setLayout={setLayout}
            fontSize={fontSize}
            setFontSize={setFontSize}
            dataSaver={dataSaver}
            setDataSaver={setDataSaver}
            focusMode={focusMode}
            setFocusMode={setFocusMode}
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
            responseStyle={responseStyle}
            setResponseStyle={setResponseStyle}
            outputLength={outputLength}
            setOutputLength={setOutputLength}
            onExportChat={handleExportChat}
            onShareConversation={handleShareConversation}
            shareStatus={shareStatus}
            canShare={history.length > 0}
            neuralNoiseEnabled={neuralNoiseEnabled}
            setNeuralNoiseEnabled={setNeuralNoiseEnabled}
            showVisualizerButton={showVisualizerButton}
            setShowVisualizerButton={(value) => {
              setShowVisualizerButton(value);
              if (!value) {
                // The nav button is the visualizer's only on/off control -
                // hiding it while the visualizer is still running would leave
                // it stuck on with no way to turn it off.
                setVisualizerEnabled(false);
              }
            }}
            availableModels={availableModels}
          />
        )}
      </AnimatePresence>


      {/* Looks Modal */}
      <AnimatePresence>
        {isLooksOpen && (
          <LooksModal
            isOpen={isLooksOpen}
            onClose={() => setIsLooksOpen(false)}
            currentLook={look}
            setLook={setLook}
          />
        )}
      </AnimatePresence>

      {/* Command Palette - Cmd/Ctrl+K quick actions */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <CommandPaletteModal
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            actions={commandActions}
          />
        )}
      </AnimatePresence>

      {/* Shortcuts Help - "?" overlay listing all available shortcuts */}
      <AnimatePresence>
        {isShortcutsHelpOpen && (
          <ShortcutsHelpModal
            isOpen={isShortcutsHelpOpen}
            onClose={() => setIsShortcutsHelpOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More Models Modal */}
      <AnimatePresence>
        {isMoreModelsOpen && (
          <MoreModelsModal
            isOpen={isMoreModelsOpen}
            onClose={() => setIsMoreModelsOpen(false)}
            models={filteredAvailableModels}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            onInitialize={handleInitialize}
          />
        )}
      </AnimatePresence>

      {/* Chat History Panel */}
      <AnimatePresence>
        {isHistoryOpen && (
          <ConversationHistoryModal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={switchConversation}
            onRename={renameConversation}
            onDelete={deleteConversation}
            onNewChat={startNewChat}
          />
        )}
      </AnimatePresence>

      {/* Interactive Particle Background for Deep Space Look */}

      {/* Main Content Area */}
      <main id="main-content" className={`theme-shell relative z-10 flex-1 flex flex-col px-6 pt-20 pb-20 overflow-y-auto overflow-x-hidden transition-[padding-left] duration-300 ${isSidebarExpanded ? 'md:pl-[212px]' : 'md:pl-24'}`}>

        {/* Global Feed - Expandable Section */}
        <AnimatePresence>
          {isGlobalFeedOpen && (
            <GlobalFeedExpanded onClose={() => setIsGlobalFeedOpen(false)} onAskAbout={askAboutStory} />
          )}
        </AnimatePresence>

        {/* Landing Hero (Shown when NOT in Chat Mode) */}
        <AnimatePresence mode="wait">
          {!isChatMode && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-8 pt-20 pb-16 min-h-[60vh] justify-center"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="label inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                Engine of Truth
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="serif-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] text-balance text-[var(--foreground)] inline-flex items-center gap-3"
              >
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--accent)] shrink-0" aria-hidden="true" />
                <span>
                  What should we{' '}
                  <span className="text-[var(--accent)]">get into</span>?
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-base md:text-lg text-[var(--muted)] max-w-xl mx-auto leading-relaxed text-balance"
              >
                Powered by{' '}
                <span className="text-[var(--foreground)]">
                  {selectedModelId === 'multi-perspective' ? 'multiple models at once' : selectedModel.name}
                </span>.
              </motion.p>

              {/* Landing composer - a visually distinct instance from the
                  fixed in-chat composer below (separate markup, no shared
                  state beyond `query`/`handleSubmit`), placed prominently
                  in the middle of the empty state the way Claude's new-chat
                  screen leads with the composer rather than a CTA button. */}
              <motion.form
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.26 }}
                onSubmit={handleSubmit}
                className="w-full max-w-xl pt-2"
              >
                <div className={`composer-bar flex items-center gap-2 rounded-[28px] bg-[var(--panel-bg)] backdrop-blur-2xl border border-[var(--border)] shadow-[var(--shadow-md)] ${isMobile ? 'p-2 pl-5' : 'p-2.5 pl-6'}`}>
                  <label htmlFor="landing-query-input" className="sr-only">
                    {`Ask ${selectedModel.name} anything`}
                  </label>
                  <Textarea
                    id="landing-query-input"
                    name="query"
                    rows={1}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Type / for skills"
                    className="flex-1 resize-none min-h-0 h-auto border-none bg-transparent shadow-none px-0 py-2 text-base md:text-lg placeholder:text-[var(--foreground)]/35 font-light focus-visible:ring-0 focus-visible:border-none"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    aria-label="Query input"
                  />
                  <Button
                    type="submit"
                    disabled={!query.trim()}
                    size="icon"
                    className="w-10 h-10 flex-shrink-0 rounded-2xl shadow-[0_4px_20px_-4px_var(--accent-glow)]"
                    title="Send"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </motion.form>

              {/* Secondary entry points - deliberately quiet text links, not
                  competing buttons, now that the composer above is the
                  primary way in. `handleInitialize` (with its initialize
                  tracking call) and the Looks modal trigger are unchanged. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.32 }}
                className="flex items-center gap-4 text-sm text-[var(--muted)]"
              >
                <button
                  onClick={handleInitialize}
                  className="hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1.5"
                >
                  Start blank <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-[var(--border)]" aria-hidden="true">•</span>
                <button
                  onClick={() => setIsLooksOpen(true)}
                  className="hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-1.5"
                >
                  <Paintbrush className="w-3.5 h-3.5" /> Explore looks
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 w-full max-w-xl pt-6`}
              >
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.45 + idx * 0.05 }}
                    onClick={() => injectPrompt(prompt)}
                    className="card-hover bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-strong)] rounded-2xl px-4 py-3.5 text-sm text-left text-[var(--muted)] hover:text-[var(--foreground)] leading-relaxed"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Section (Shown when NOT in Chat Mode) */}
        {!isChatMode && (
          <div className="w-full max-w-7xl mx-auto mt-8 space-y-16 pb-20">

            {/* Browse AI Models */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="serif-display text-2xl text-[var(--foreground)]">Browse AI Models</h2>
                </div>
                <button
                  onClick={() => setIsMoreModelsOpen(true)}
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  View All Models <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAvailableModels.slice(0, 6).map((model, idx) => (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4 }}
                    onClick={() => {
                      setSelectedModelId(model.id);
                      handleInitialize();
                    }}
                    className="card-hover bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)]/12 flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-colors">
                        {(() => {
                          const CategoryIcon = model.category === 'OpenRouter' ? Globe
                            : model.category === 'Premium' ? Sparkles
                            : model.category === 'Advanced' ? Star
                            : Zap;
                          return <CategoryIcon className="w-4 h-4 text-[var(--accent)]" />;
                        })()}
                      </div>
                      <span className="label px-2 py-1 rounded-full border border-[var(--border)]">
                        {model.category}
                      </span>
                    </div>
                    <h3 className="text-base font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-1.5">
                      {model.name}
                    </h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-2">{model.description}</p>
                  </motion.div>
                ))}
              </div>
            </section>


            {/* Code Examples */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="serif-display text-2xl text-[var(--foreground)]">Code Examples</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: 'API Integration',
                    code: `fetch('/api/query-gateway', {
  method: 'POST',
  body: JSON.stringify({
    query: 'Explain AI',
    model: 'ooverta'
  })
})`,
                    language: 'javascript',
                  },
                  {
                    title: 'Streaming Response',
                    code: `const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk
}`,
                    language: 'javascript',
                  },
                ].map((example, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"
                  >
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-3">{example.title}</h3>
                    <pre className="bg-[var(--surface-strong)] rounded-lg p-4 overflow-x-auto text-xs font-mono text-[var(--foreground)]">
                      <code>{example.code}</code>
                    </pre>
                  </motion.div>
                ))}
              </div>
            </section>

          </div>
        )}

        {/* Chat Interface (Shown in Chat Mode) */}
        <AnimatePresence>
          {isChatMode && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`theme-content w-full mx-auto h-full flex flex-col transition-all duration-500 ${isFullscreen ? 'max-w-full px-4' : ''} ${isMobile ? 'px-4' : ''}`}
              data-chat-area="true"
            >
              <div className={`interface-grid h-full ${isMobile ? 'grid-cols-1' : ''}`}>
                {/* Intel Panel (Left) - Hidden in Fullscreen and Mobile */}
                {!isFullscreen && !isMobile && (
                  <section className={`intel-panel hidden lg:grid content-start gap-4 transition-all duration-300 ${closedWidgets.has('active-intel') && closedWidgets.has('ops-snapshot') ? 'hidden' : ''}`}>
                    {!closedWidgets.has('active-intel') && (
                      <div className="intel-card relative">
                        <button
                          onClick={() => toggleWidget('active-intel')}
                          className="absolute top-3 right-3 p-1 rounded-full hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                          title="Close widget"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <span className="label">Active Intelligence</span>
                        <h3 className="font-light">{selectedModel.name}</h3>
                        <p>{selectedModel.description}</p>
                        <button
                          onClick={startNewChat}
                          className="mt-6 text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> End Session
                        </button>
                      </div>
                    )}

                    {!closedWidgets.has('ops-snapshot') && (
                      <div className="intel-card relative">
                        <button
                          onClick={() => toggleWidget('ops-snapshot')}
                          className="absolute top-3 right-3 p-1 rounded-full hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                          title="Close widget"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <span className="label">Ops Snapshot</span>
                        <div className="mt-4 space-y-4">
                          {SIGNALS.map(signal => (
                            <div key={signal.title}>
                              <p className="label">{signal.title}</p>
                              <p className="text-base mt-1 text-[var(--foreground)]/80">{signal.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Main Chat Stack (Right/Center) */}
                <section className={`chat-stack flex flex-col h-full justify-between transition-all duration-500 ${isFullscreen || (closedWidgets.has('active-intel') && closedWidgets.has('ops-snapshot')) || isMobile ? 'col-span-full' : ''} ${isMobile ? 'px-0' : ''}`}>
                  {/* Search Bar */}
                  {showSearch && (
                    <div className="mb-4 glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <Search className="w-4 h-4 text-[var(--muted)]" />
                        <label htmlFor="search-conversation" className="sr-only">
                          Search conversation history
                        </label>
                        <input
                          id="search-conversation"
                          name="search-conversation"
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search conversation history..."
                          className="flex-1 bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--muted)]"
                          autoFocus
                          aria-label="Search conversation history"
                        />
                        <button
                          onClick={() => {
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          className="p-1 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* dvh (not vh) so this doesn't mis-size as iOS/Android
                      Safari and Chrome show/hide their address bar - 100vh
                      is pinned to the largest possible viewport and doesn't
                      shrink with the toolbar, so history could extend
                      underneath the fixed composer bar at the bottom. */}
                  <div
                    ref={historyScrollRef}
                    onScroll={handleHistoryScroll}
                    className={`overflow-y-auto custom-scrollbar ${isMobile ? 'pr-2' : 'pr-4'}`}
                    style={{ maxHeight: 'calc(100dvh - 300px)', minHeight: '200px' }}
                  >
                    {/* Conversation History */}
                    <div className="space-y-6 mb-6">
                      {history
                        .filter(entry => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return entry.query.toLowerCase().includes(query) || entry.response.toLowerCase().includes(query);
                        })
                        .map((entry, idx) => {
                          const originalIdx = history.indexOf(entry);
                          return (
                            <div key={originalIdx} className="space-y-4">
                              {/* User Message - a lighter surface tint (no
                                  blur/shadow chrome) so it reads as a quiet
                                  aside rather than competing with the
                                  assistant's plain-prose response below. */}
                              <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-6 py-5"
                              >
                                <div className="flex items-start gap-4 max-w-[70ch]">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/20 flex-shrink-0">
                                    <Zap className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="label text-[var(--accent)] mb-2">
                                      You
                                    </div>
                                    {entry.image && (
                                      <div className="mb-3 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-strong)]">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- client-side base64 data URL, not a next/image-optimizable asset */}
                                        <img
                                          src={entry.image}
                                          alt="User uploaded"
                                          className="max-w-full max-h-[300px] object-contain"
                                        />
                                      </div>
                                    )}
                                    <div className="text-[var(--foreground)] text-lg leading-relaxed font-light">
                                      {entry.query}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>

                              {/* AI Response - deliberately no card chrome
                                  (no border/blur/shadow): the assistant's
                                  reply flows as plain prose, like Claude.ai,
                                  instead of sitting in a bordered bubble. */}
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="px-6 py-2"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="label text-[var(--accent)] min-w-0 truncate">
                                        {entry.generatedImage
                                          ? 'Image Generation (HF)'
                                          : filteredAvailableModels.find(m => m.id === entry.model)?.name || availableModels.find(m => m.id === entry.model)?.name || 'AI'}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {!entry.generatedImage && (
                                          <button
                                            onClick={() => copyResponseToClipboard(originalIdx, entry.response)}
                                            className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                            title="Copy response"
                                          >
                                            {copiedResponseIdx === originalIdx ? (
                                              <Check className="w-4 h-4" />
                                            ) : (
                                              <Copy className="w-4 h-4" />
                                            )}
                                          </button>
                                        )}
                                        <button
                                          onClick={() => {
                                            setQuery(entry.query);
                                            setSelectedImage(entry.image || null);
                                            inputRef.current?.focus();
                                          }}
                                          className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                          title="Edit & Regenerate"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={async () => {
                                            // Regenerate with same query
                                            setIsProcessing(true);
                                            setResponse('');
                                            const controller = new AbortController();
                                            setAbortController(controller);

                                            try {
                                              const conversationHistory = history.slice(0, originalIdx).map(h => {
                                                const content: ChatContent = h.image
                                                  ? [
                                                    { type: 'text', text: h.query },
                                                    { type: 'image_url', image_url: { url: h.image } },
                                                  ]
                                                  : h.query;
                                                return [
                                                  { role: 'user' as const, content },
                                                  { role: 'assistant' as const, content: h.response },
                                                ];
                                              }).flat();

                                              const res = await fetch('/api/query-gateway', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  query: entry.query,
                                                  image: entry.image || undefined,
                                                  model: selectedModelId,
                                                  systemPrompt: buildEffectiveSystemPrompt(),
                                                  conversationHistory: conversationHistory
                                                }),
                                                signal: controller.signal,
                                              });

                                              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                                              const reader = res.body?.getReader();
                                              const decoder = new TextDecoder();
                                              if (!reader) throw new Error('No reader available');

                                              let fullResponse = '';
                                              while (true) {
                                                const { done, value } = await reader.read();
                                                if (done) break;
                                                const chunk = decoder.decode(value, { stream: true });
                                                const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
                                                for (const line of lines) {
                                                  try {
                                                    const data = JSON.parse(line.slice(6));
                                                    if (data.content) {
                                                      fullResponse += data.content;
                                                      setResponse(fullResponse);
                                                    }
                                                    if (data.done) {
                                                      setIsProcessing(false);
                                                      setAbortController(null);
                                                      setHistory(prev => {
                                                        const newHistory = [...prev];
                                                        newHistory[originalIdx] = { ...newHistory[originalIdx], response: fullResponse };
                                                        return newHistory;
                                                      });
                                                      setResponse(null);
                                                      return;
                                                    }
                                                  } catch { }
                                                }
                                              }
                                            } catch (caughtError) {
                                              const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
                                              console.error('Regenerate error:', error);
                                              setIsProcessing(false);
                                              setAbortController(null);
                                            }
                                          }}
                                          className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                          title="Regenerate Response"
                                        >
                                          <RefreshCw className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleMessageFeedback(originalIdx, 'up', entry.model)}
                                          className={`p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors ${
                                            messageFeedback[originalIdx] === 'up'
                                              ? 'text-[var(--accent)]'
                                              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                                          }`}
                                          title="Good response"
                                        >
                                          <ThumbsUp className="w-4 h-4" fill={messageFeedback[originalIdx] === 'up' ? 'currentColor' : 'none'} />
                                        </button>
                                        <button
                                          onClick={() => handleMessageFeedback(originalIdx, 'down', entry.model)}
                                          className={`p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors ${
                                            messageFeedback[originalIdx] === 'down'
                                              ? 'text-[var(--accent)]'
                                              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                                          }`}
                                          title="Bad response"
                                        >
                                          <ThumbsDown className="w-4 h-4" fill={messageFeedback[originalIdx] === 'down' ? 'currentColor' : 'none'} />
                                        </button>
                                      </div>
                                    </div>
                                    {entry.reasoning && (
                                      <div className="mb-3">
                                        <ReasoningSection
                                          text={entry.reasoning}
                                          isStreaming={false}
                                          expanded={!!expandedReasoning[originalIdx]}
                                          onToggle={() => setExpandedReasoning(prev => ({ ...prev, [originalIdx]: !prev[originalIdx] }))}
                                        />
                                      </div>
                                    )}
                                    {entry.generatedImage ? (
                                      <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-strong)]">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- server-fetched base64 data URL, not a next/image-optimizable asset */}
                                        <img
                                          src={entry.generatedImage}
                                          alt={entry.query}
                                          className="max-w-full max-h-[512px] object-contain"
                                        />
                                      </div>
                                    ) : entry.perspectives && entry.perspectives.length > 0 ? (
                                      <div className="grid md:grid-cols-2 gap-4">
                                        {entry.perspectives.map((p) => (
                                          <div
                                            key={p.model}
                                            className="glass-panel card-hover bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
                                          >
                                            <div className="label text-[var(--accent)] mb-2">
                                              {availableModels.find(m => m.id === p.model)?.name || p.model}
                                            </div>
                                            <div className="text-[var(--foreground)] text-base font-light markdown-content">
                                              <MarkdownMessage content={p.content} />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="max-w-[70ch] text-[var(--foreground)] text-lg font-light markdown-content">
                                        <MarkdownMessage content={entry.response} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Current Response (if processing or showing latest) */}
                    <AnimatePresence mode="popLayout">
                      {(response || isProcessing || perspectiveResponses) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="px-6 py-2 mb-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                            </div>
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="label text-[var(--accent)]">
                                {perspectiveResponses
                                  ? 'Comparing Perspectives…'
                                  : isProcessing ? 'Processing…' : `Response from ${selectedModel.name}`}
                              </div>
                              {!isProcessing && statusNote && (
                                <div className="label">
                                  {statusNote}
                                </div>
                              )}
                              {perspectiveResponses ? (
                                <div className="space-y-3">
                                  <button
                                    onClick={handleStop}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                  >
                                    <Square className="w-3 h-3" />
                                    Stop
                                  </button>
                                <div className="grid md:grid-cols-2 gap-4">
                                  {Object.entries(perspectiveResponses).map(([modelId, content]) => {
                                    const isDone = perspectiveDoneModels.has(modelId);
                                    return (
                                      <div
                                        key={modelId}
                                        className="glass-panel card-hover bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
                                      >
                                        <div className="label text-[var(--accent)] mb-2">
                                          {availableModels.find(m => m.id === modelId)?.name || modelId}
                                        </div>
                                        {!isDone && (
                                          <div className="mb-2">
                                            {thinkingIndicator}
                                          </div>
                                        )}
                                        {content && (
                                          <div className="text-[var(--foreground)] text-base font-light markdown-content">
                                            <MarkdownMessage content={content} />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  </div>
                                </div>
                              ) : (
                                // Note: this previously carried Tailwind Typography's
                                // `prose prose-invert max-w-none` classes, but that
                                // plugin isn't installed in this project - they were
                                // dead no-op classes. The actual markdown styling
                                // comes from the `markdown-content` class below.
                                <div className="space-y-3">
                                  {reasoning && (
                                    <ReasoningSection
                                      text={reasoning}
                                      isStreaming={isProcessing && !response}
                                      expanded={liveReasoningExpanded}
                                      onToggle={() => setLiveReasoningExpanded(v => !v)}
                                    />
                                  )}
                                  {/* Before the first token arrives, show the
                                      "thinking" indicator; once any text has
                                      streamed in, render it immediately rather
                                      than hiding it behind the loader until
                                      the whole response finishes - matches
                                      how token-by-token streaming actually
                                      reads as live progress instead of a
                                      frozen UI. */}
                                  {isProcessing && !response ? (
                                    <div className="flex items-center gap-3">
                                      {/* The reasoning box's own pulsing dot
                                          already signals activity while
                                          extended thinking is streaming, so
                                          the thinking indicator is redundant. */}
                                      {!reasoning && thinkingIndicator}
                                      <button
                                        onClick={handleStop}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                      >
                                        <Square className="w-3 h-3" />
                                        Stop
                                      </button>
                                    </div>
                                  ) : response ? (
                                    <div className="max-w-[70ch] text-[var(--foreground)] text-lg font-light markdown-content">
                                      <MarkdownMessage content={response} />
                                      {isProcessing && (
                                        <div className="flex items-center gap-3 mt-3">
                                          <span
                                            aria-hidden="true"
                                            className="inline-block w-2 h-4 bg-[var(--accent)] rounded-sm animate-pulse"
                                          />
                                          <button
                                            onClick={handleStop}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                          >
                                            <Square className="w-3 h-3" />
                                            Stop
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Empty State */}
                    {history.length === 0 && !response && !isProcessing && (
                      <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] opacity-50">
                        <Zap className="w-12 h-12 mb-4" />
                        <p>Ready to query.</p>
                      </div>
                    )}

                    {/* Auto-scroll anchor - always at the bottom */}
                    <div ref={responseEndRef} />
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Deck - Fixed at bottom for chat mode */}
      {isChatMode && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/95 backdrop-blur-xl border-t border-[var(--border)] transition-[padding-left] duration-300 ${isMobile ? 'p-3' : 'p-4'} ${!isMobile && isSidebarExpanded ? 'md:pl-[200px]' : ''}`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), var(--space-3, 0.75rem))' }}
        >
          <div className={`max-w-7xl mx-auto ${isMobile ? 'px-2' : ''}`}>
            <AnimatePresence>
              {selectedImage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-4 relative inline-block"
                >
                  <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-strong)] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- client-side base64 data URL, not a next/image-optimizable asset */}
                    <img
                      src={selectedImage}
                      alt="Preview"
                      className="max-w-[200px] max-h-[200px] object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1.5 bg-[var(--hud-bg)] backdrop-blur-sm border border-[var(--border)] rounded-full hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {visualizerEnabled && (
              <div className="mb-2 px-1">
                <MicFrequencyBars bandsRef={micBandsRef} levelRef={micLevelRef} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative">
              <div
                className={`composer-bar relative rounded-[28px] bg-[var(--panel-bg)] backdrop-blur-2xl border shadow-[var(--shadow-md)] transition-all duration-300 ${isDraggingImage ? 'border-[var(--accent)]' : 'border-[var(--border)]'} ${isMobile ? 'p-3' : 'p-4'}`}
                onDragOver={handleComposerDragOver}
                onDragLeave={handleComposerDragLeave}
                onDrop={handleComposerDrop}
              >
                {/* Drop-zone overlay - only visible while actively dragging an image over the composer */}
                <AnimatePresence>
                  {isDraggingImage && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10"
                    >
                      <span className="text-sm font-medium text-[var(--accent)]">Drop image to attach</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Row 1: the growing textarea itself, full-width and
                    uncluttered - reference's low-chrome look keeps every
                    control below it, not crowding the typing area. */}
                <label htmlFor="query-input-bottom" className="sr-only">
                  {isImageGenMode ? 'Describe an image to generate' : `Ask ${selectedModel.name} anything`}
                </label>
                <Textarea
                  ref={inputRef}
                  id="query-input-bottom"
                  name="query"
                  rows={1}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onPaste={handleComposerPaste}
                  onKeyDown={(e) => {
                    // Enter sends, Shift+Enter inserts a newline - matches
                    // the multi-line composer convention. Ignore Enter
                    // while an IME composition is in progress (e.g.
                    // confirming Japanese/Chinese input) so it doesn't
                    // submit prematurely.
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      if (!isProcessing && query.trim()) {
                        handleSubmit(e);
                      }
                    }
                  }}
                  placeholder={isImageGenMode ? 'Describe an image to generate…' : 'Type / for skills'}
                  className="composer-textarea w-full resize-none custom-scrollbar border-none bg-transparent shadow-none text-[var(--foreground)] text-lg placeholder:text-[var(--foreground)]/35 transition-colors font-light leading-normal px-1 py-1 focus-visible:ring-0 min-h-0 h-auto"
                  style={{ maxHeight: COMPOSER_MAX_HEIGHT_PX }}
                  disabled={isProcessing}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  aria-label="Query input"
                />

                {/* Row 2: every other control - attach (+) on the left,
                    model picker + secondary actions + mic + send on the
                    right, matching the reference composer's low bottom
                    toolbar instead of one crowded single row. */}
                <div className={`flex items-center justify-between gap-2 pt-2 ${isMobile ? 'flex-wrap' : ''}`}>
                  <div className={`flex items-center gap-1 ${isMobile ? 'flex-wrap' : ''}`}>
                    {/* Attach Image */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageSelect}
                      className="hidden"
                      aria-hidden="true"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImageUploadDisabled || isImageGenMode}
                      className="rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
                      title={isImageGenMode ? 'Switch off image generation to attach an image' : isImageUploadDisabled ? `Image upload disabled: ${imageUploadDisabledReason}` : 'Attach image'}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>

                    {/* Generate Image - toggles the composer into text-to-image
                        mode (Stable Diffusion 3 Medium via Hugging Face's
                        Inference Providers), a separate capability from the
                        chat models above rather than one more model-picker
                        entry, since it produces an image rather than text. */}
                    {!hideImageGen && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsImageGenMode(prev => !prev)}
                        disabled={!!selectedImage}
                        className={`rounded-full ${isImageGenMode
                          ? 'text-[var(--accent)] bg-[var(--accent)]/10 hover:text-[var(--accent)]'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                        title={selectedImage ? 'Remove the attached image to generate one instead' : isImageGenMode ? 'Switch back to chat' : 'Generate an image from a text prompt'}
                      >
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Fullscreen Toggle - hidden (not disabled) when the
                        Fullscreen API isn't available, e.g. iOS Safari, same
                        convention as the dictation/image-gen controls above. */}
                    {isFullscreenSupported && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        className="rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
                        title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
                      >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                      </Button>
                    )}

                    {/* Chat History - opens the panel listing past
                        conversations to switch between, rename, or delete. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsHistoryOpen(true)}
                      className="rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
                      title="Chat History"
                    >
                      <History className="w-4 h-4" />
                    </Button>

                    {/* New Chat - leaves the current conversation persisted in
                        history and returns to the landing view for a fresh
                        one. */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={startNewChat}
                      className="rounded-full text-[var(--muted)] hover:text-[var(--foreground)]"
                      title="New Chat"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>

                    {/* Multi-Perspective Model Selectors - Only shown when Multi-Perspective is selected */}
                    {selectedModelId === 'multi-perspective' && (
                      <div className={`flex items-center gap-2 ${isMobile ? 'w-full pl-0 ml-0 mt-1 border-l-0' : 'border-l border-[var(--border)] pl-2 ml-1'}`}>
                        <span className="text-xs text-[var(--muted)] whitespace-nowrap hidden sm:inline">Combine:</span>
                        <select
                          value={parallelModel1}
                          onChange={(e) => setParallelModel1(e.target.value)}
                          className={`px-2 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors outline-none ${isMobile ? 'min-w-0 flex-1' : ''}`}
                        >
                          {combineModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <span className="text-xs text-[var(--accent)]">+</span>
                        <select
                          value={parallelModel2}
                          onChange={(e) => setParallelModel2(e.target.value)}
                          className={`px-2 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors outline-none ${isMobile ? 'min-w-0 flex-1' : ''}`}
                        >
                          {combineModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isProcessing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleStop}
                        className="gap-1.5 rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]"
                      >
                        <Square className="w-3.5 h-3.5" />
                        Stop
                      </Button>
                    )}

                    {/* Model picker - shadcn DropdownMenu replacing the old
                        hand-rolled AnimatePresence popover, same model list
                        and selection behavior. */}
                    <DropdownMenu open={isModelMenuOpen} onOpenChange={setIsModelMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 rounded-full text-[var(--accent)] hover:text-[var(--accent)] font-medium"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline max-w-[9rem] truncate">{selectedModel.name}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="top" className="w-56 max-h-64 overflow-y-auto custom-scrollbar">
                        {filteredAvailableModels.map(model => (
                          <DropdownMenuItem
                            key={model.id}
                            onSelect={() => setSelectedModelId(model.id)}
                            className={`flex items-center justify-between text-xs ${selectedModelId === model.id ? 'text-[var(--accent)]' : ''}`}
                          >
                            {model.name}
                            {selectedModelId === model.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Dictation - real speech-to-text via the browser's native
                        Web Speech API, not just the decorative visualizer mic.
                        Hidden entirely (not disabled) when unsupported, per
                        this codebase's "never show a broken-looking control"
                        convention. */}
                    {isDictationSupported && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (isDictating) {
                            stopDictation();
                            return;
                          }
                          dictationPrefixRef.current = query ? `${query} ` : '';
                          dictationFinalRef.current = '';
                          startDictation(
                            (interim) => setQuery(dictationPrefixRef.current + dictationFinalRef.current + interim),
                            (final) => {
                              dictationFinalRef.current += `${final} `;
                              setQuery(dictationPrefixRef.current + dictationFinalRef.current);
                            }
                          );
                        }}
                        className={`relative rounded-full ${isDictating
                          ? 'text-[var(--accent)] bg-[var(--accent)]/10 hover:text-[var(--accent)]'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                        title={dictationError ?? (isDictating ? 'Stop dictation' : 'Dictate your message')}
                      >
                        {isDictating && (
                          <motion.span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full bg-[var(--accent)]/20"
                            animate={{ opacity: [0.3, 0.7, 0.3] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                        <Mic className="w-4 h-4 relative z-10" />
                      </Button>
                    )}

                    <Button
                      type="submit"
                      disabled={!query.trim() || isProcessing}
                      size="icon"
                      className="w-10 h-10 rounded-2xl shadow-[0_4px_20px_-4px_var(--accent-glow)]"
                    >
                      {isProcessing ? (
                        <Zap className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expanded Sections (Only on Landing) */}
      {!isChatMode && (
        <>
          <section id="mission" className="relative z-10 py-32 border-t border-[var(--border)]">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="serif-display text-4xl mb-8 text-[var(--foreground)]">Our Mission</h2>
              <p className="text-xl text-[var(--muted)] leading-relaxed">
                In an era of curated realities and algorithmic bias, truth has become a scarcity.
                Roovert exists to reverse this entropy. We are building the world&apos;s most rigorous
                AI engine, designed not to please, but to <span className="text-[var(--accent)]">understand</span>.
              </p>
            </div>
          </section>

          {/* Built With Itself Section */}
          <section className="relative z-10 py-32 border-t border-[var(--border)]">
            <div className="max-w-5xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Code className="w-6 h-6 text-[var(--accent)]" />
                  <h2 className="serif-display text-3xl text-[var(--foreground)]">Built With Itself</h2>
                </div>
                <div className="space-y-6 text-[var(--foreground)]/80 leading-relaxed">
                  <p className="text-lg">
                    Here&apos;s something interesting: large portions of Roovert were built using Roovert itself.
                  </p>
                  <p>
                    The code you&apos;re reading, the components rendering on this page, the API routes handling your requests—many of them started as conversations with the AI models powering this interface. We asked questions, refined prompts, iterated on responses, and built features in real-time through the same chat interface you&apos;re using now.
                  </p>
                  <p>
                    This isn&apos;t a gimmick. It&apos;s a practical demonstration of what happens when you treat AI as a first-class development tool rather than a novelty. The privacy policy, the consent banner, the visitor tracking system, the UI components—all of it emerged from iterative conversations where we challenged assumptions, tested implementations, and refined code until it worked.
                  </p>
                  <p>
                    There&apos;s something recursive about building an AI interface with AI. You end up with a product that understands its own construction, that can explain its architecture, that knows why certain decisions were made. It creates a kind of self-awareness in the codebase that traditional development doesn&apos;t usually achieve.
                  </p>
                  <p className="text-[var(--accent)] font-medium">
                    We&apos;re not just building tools for AI. We&apos;re building tools with AI, and that changes everything.
                  </p>
                </div>
              </motion.div>
            </div>
          </section>

          <footer className="relative z-10 border-t border-[var(--border)] py-8 text-center text-[var(--foreground)]/40 text-sm">
            <p>© 2026 Roovert. Rigorously Pursuing Truth.</p>
          </footer>
        </>
      )}
    </div>
  );
}
