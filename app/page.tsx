'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Zap, Settings, X, Globe, ChevronDown, Clock, AlertTriangle, RotateCcw, Monitor, Maximize, Minimize, Download, Eye, EyeOff, Palette } from 'lucide-react';

const MODELS = [
  { id: 'ooverta', name: 'Ooverta (Default)', apiId: 'ooverta', category: 'Standard', description: 'The engine of truth. Web-aware.' },
  { id: 'gemini-flash', name: 'Gemini 2.0 Flash', apiId: 'google/gemini-2.0-flash-exp:free', category: 'Standard', description: 'Fast, efficient, google-powered.' },
  { id: 'deepseek-free', name: 'DeepSeek R1', apiId: 'deepseek/deepseek-r1-0528:free', category: 'Standard', description: 'Fast, efficient reasoning.' },
  { id: 'nemotron-30b', name: 'Nvidia Nemotron 30B', apiId: 'nvidia/nemotron-3-nano-30b-a3b:free', category: 'Standard', description: 'Compact, powerful Nvidia model.' },
  { id: 'llama-405b', name: 'Llama 3.1 405B', apiId: 'nousresearch/hermes-3-llama-3.1-405b:free', category: 'Advanced', description: 'Massive open-source intelligence.' },
  { id: 'gpt-4o', name: 'GPT-4o', apiId: 'openai/gpt-4o', category: 'Advanced', description: 'Top-tier general intelligence.' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', apiId: 'anthropic/claude-3.5-sonnet', category: 'Advanced', description: 'Nuanced and articulate.' },
  { id: 'perplexity', name: 'Perplexity', apiId: 'perplexity/sonar-reasoning', category: 'Advanced', description: 'Real-time search engine.' },
];

const QUICK_PROMPTS = [
  'Stress test this assumption about AGI timelines.',
  'Summarize the latest x-risk research with citations.',
  'Cross-check today’s markets sentiment vs macro data.',
  'Explain why the universe favors or rejects life.',
];

const SIGNALS = [
  { title: 'Mission Feed', detail: 'Truth Ops syncing with live telemetry.' },
  { title: 'Signal Integrity', detail: 'All anomalies logged and traced.' },
  { title: 'Public API', detail: 'Latency holding at 182ms global.' },
];

// Layout/Animation Options
const LAYOUTS = [
  { id: 'standard', name: 'Standard' },
  { id: 'compact', name: 'Compact' },
  { id: 'wide', name: 'Spacious' },
];

// Looks - Complete visual transformations
const LOOKS = [
  { id: 'default', name: 'Default', description: 'Clean, modern interface', category: 'basic' },
  { id: 'wildwest', name: 'Wild West', description: 'Dusty saloon vibes with rustic charm', category: 'themed' },
  { id: 'frutigeraero', name: 'Frutiger Aero', description: 'Y2K nostalgia with nature & tech fusion', category: 'themed' },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon-soaked dystopian future', category: 'themed' },
  { id: 'matrix', name: 'Matrix', description: 'Green code rain aesthetic', category: 'themed' },
  { id: 'retrowave', name: 'Retrowave', description: 'Synthwave 80s vibes', category: 'themed' },
  { id: 'minimalist', name: 'Minimalist', description: 'Ultra-clean, focused design', category: 'style' },
  { id: 'darkmode', name: 'Dark Mode Pro', description: 'Deep blacks with vibrant accents', category: 'style' },
  { id: 'pastel', name: 'Pastel Dreams', description: 'Soft, dreamy pastel colors', category: 'style' },
  { id: 'neon', name: 'Neon Nights', description: 'Electric neon on dark background', category: 'style' },
  { id: 'ocean', name: 'Ocean Depths', description: 'Deep blue aquatic theme', category: 'nature' },
  { id: 'forest', name: 'Forest Canopy', description: 'Green nature-inspired palette', category: 'nature' },
  { id: 'sunset', name: 'Sunset Glow', description: 'Warm orange and pink gradients', category: 'nature' },
  { id: 'space', name: 'Deep Space', description: 'Cosmic darkness with stars', category: 'nature' },
  { id: 'paper', name: 'Paper & Ink', description: 'Vintage paper texture aesthetic', category: 'vintage' },
  { id: 'terminal', name: 'Terminal', description: 'Classic terminal green on black', category: 'vintage' },
];

// Looks Modal Component
function LooksModal({ isOpen, onClose, currentLook, setLook }: any) {
  if (!isOpen) return null;

  const categories = ['basic', 'themed', 'style', 'nature', 'vintage'];
  const looksByCategory = categories.map(cat => ({
    category: cat,
    looks: LOOKS.filter(l => l.category === cat)
  }));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-5xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-light tracking-wide flex items-center gap-2">
            <Palette className="w-6 h-6 text-[var(--accent)]" />
            Browse Looks
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {looksByCategory.map(({ category, looks }) => (
            <section key={category}>
              <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {looks.map(look => (
                  <button
                    key={look.id}
                    onClick={() => { setLook(look.id); onClose(); }}
                    className={`p-4 rounded-xl border transition-all duration-300 text-left ${
                      currentLook === look.id 
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20' 
                        : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
                    }`}
                  >
                    <div className="font-medium text-[var(--foreground)] mb-1">{look.name}</div>
                    <div className="text-xs text-[var(--muted)]">{look.description}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Settings Modal Component
function SettingsModal({ 
  isOpen, 
  onClose, 
  currentModelId, setModelId,
  layout, setLayout,
  fontSize, setFontSize,
  dataSaver, setDataSaver,
  focusMode, setFocusMode,
  systemPrompt, setSystemPrompt,
  onExportChat,
  currentLook, setLook,
  onOpenLooks
}: any) {
  if (!isOpen) return null;

  const handleReset = () => {
    setLayout('standard');
    setFontSize('normal');
    setDataSaver(false);
    setFocusMode(false);
    setSystemPrompt('');
    setModelId('ooverta');
    setLook('default');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col text-[var(--foreground)]"
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-light tracking-wide flex items-center gap-2 text-[var(--foreground)]">
            <Settings className="w-5 h-5 text-[var(--accent)]" />
            System Configuration
          </h2>
          <div className="flex items-center gap-2">
            <button 
                onClick={handleReset}
                className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]"
            >
                Reset Defaults
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          
          {/* Looks Section - Quick Select or Browse More */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <Palette className="w-4 h-4" /> Looks
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <div className="text-sm font-medium text-[var(--foreground)] mb-1">
                  {LOOKS.find(l => l.id === currentLook)?.name || 'Default'}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {LOOKS.find(l => l.id === currentLook)?.description || 'Current look'}
                </div>
              </div>
              <button
                onClick={onOpenLooks}
                className="px-6 py-4 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors font-medium"
              >
                More
              </button>
            </div>
          </section>

          {/* Layout Section - Structure Only */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">Layout</h3>
            <div className="grid grid-cols-3 gap-2">
            {LAYOUTS.map(l => (
                <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    layout === l.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
                >
                {l.name}
                </button>
            ))}
            </div>
          </section>

          {/* Styles / Appearance Section - Size, Density */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">Appearance & Style</h3>
            <div className="grid gap-8">
                <div>
                    <h4 className="text-xs text-[var(--muted)] mb-2 uppercase">Text Size</h4>
                    <div className="flex gap-2">
                        {['small', 'normal', 'large'].map((size) => (
                            <button
                                key={size}
                                onClick={() => setFontSize(size)}
                                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                                    fontSize === size 
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]' 
                                    : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                                }`}
                            >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
          </section>

          {/* Preferences Section - Toggles */}
          <section className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Preferences
            </h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                            Data Saver Mode
                            {dataSaver && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">ACTIVE</span>}
                        </div>
                        <div className="text-xs text-[var(--muted)]">Reduces animations & blur effects</div>
                    </div>
                    <button
                        onClick={() => setDataSaver(!dataSaver)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                            dataSaver ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
                        }`}
                    >
                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            dataSaver ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                            Focus Mode
                            {focusMode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">ACTIVE</span>}
                        </div>
                        <div className="text-xs text-[var(--muted)]">Hide all distractions during chat</div>
                    </div>
                    <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={`p-2 rounded-lg border transition-colors ${
                            focusMode ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                        }`}
                    >
                        {focusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
            </div>
          </section>

          {/* AI Configuration */}
          <section className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono flex items-center gap-2">
                <Zap className="w-4 h-4" /> Intelligence Override
            </h3>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-[var(--muted)] uppercase">Custom System Prompt</label>
                    <textarea 
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="e.g., 'You are a pirate...' or 'Explain like I'm 5'"
                        className="w-full h-24 bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 text-sm resize-none focus:border-[var(--accent)] outline-none"
                    />
                </div>
                <button
                    onClick={onExportChat}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--surface-strong)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm transition-colors"
                >
                    <Download className="w-4 h-4" /> Export Conversation Log
                </button>
            </div>
          </section>

          {/* Model Section */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono">Default Intelligence</h3>
            <div className="grid gap-2">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setModelId(model.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    currentModelId === model.id 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--accent)]/30 bg-[var(--surface)]'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2 text-[var(--foreground)]">
                      {model.name}
                      {model.category === 'Advanced' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">PRO</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">{model.description}</div>
                  </div>
                  {currentModelId === model.id && (
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

// Widgets Component
function Widgets() {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/news').then(res => res.json()).then(setNews).catch(() => {});
  }, []);

  return (
    <div className="widgets-stack flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
      {/* News Widget */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="widget-card flex-shrink-0 min-w-[280px] max-w-[360px] p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] backdrop-blur-md"
      >
        <div className="flex items-center gap-2 mb-2 text-[var(--muted)]">
          <Globe className="w-4 h-4" />
          <span className="text-xs uppercase font-mono">Global Feed</span>
        </div>
        {news.length > 0 ? (
          <div className="space-y-3">
            {news.map((story: any) => (
          <a
                key={story.id} 
                href={story.url} 
            target="_blank"
            rel="noopener noreferrer"
                className="block text-sm hover:text-[var(--accent)] transition-colors truncate"
              >
                • {story.title}
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-[var(--surface-strong)] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-[var(--surface-strong)] rounded animate-pulse" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Real-time Stats Component
function LiveStats() {
  const [stats, setStats] = useState({
    queriesProcessed: 0,
    uniqueMinds: 0,
    totalVisitors: 0,
    accuracy: '0.00',
    uptime: '99.9%',
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Unique Visitor Tracking with Fingerprinting
    const trackVisitor = async () => {
      if (typeof window === 'undefined') return;

      try {
        // Dynamic import to avoid SSR issues
        const { getOrCreateVisitorId, generateFingerprint } = await import('./lib/fingerprint');
        const visitorId = getOrCreateVisitorId();
        const fingerprint = generateFingerprint();

        // Check if we've already tracked this session
        const sessionKey = 'roovert_tracked_session';
        const tracked = sessionStorage.getItem(sessionKey);

        if (!tracked && visitorId) {
          // Track this visitor
          await fetch('/api/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId, fingerprint }),
          });
          sessionStorage.setItem(sessionKey, 'true');
        }
      } catch (error) {
        console.error('Visitor tracking error:', error);
      }
    };

    trackVisitor();

    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 bg-[var(--hud-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-4 shadow-2xl min-w-[240px]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--muted)]">People who've used Roovert</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {(stats.totalVisitors || stats.uniqueMinds).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--muted)]">Queries</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {stats.queriesProcessed.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-[var(--muted)]">Accuracy</span>
                <span className="text-[var(--accent)] font-mono font-bold">{stats.accuracy}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-[var(--chip-bg)] backdrop-blur-xl border border-[var(--border)] rounded-full px-4 py-2 shadow-lg hover:bg-[var(--surface-strong)] transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
        <span className="text-xs text-[var(--muted-strong)] uppercase tracking-wider font-mono">
          System Status {isExpanded ? '[-]' : '[+]'}
        </span>
      </motion.button>
    </div>
  );
}

// Clock Component for Nav
function NavClock() {
  const [time, setTime] = useState<string>('');
  
  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--muted)] font-mono">
      <Clock className="w-3 h-3" />
      <span>{time}</span>
    </div>
  );
}

export default function Page() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: string; model: string }>>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false); // New: Chat Mode State
  
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLooksOpen, setIsLooksOpen] = useState(false);
  const [look, setLook] = useState('default');
  const [layout, setLayout] = useState('standard');
  const [fontSize, setFontSize] = useState('normal');
  const [dataSaver, setDataSaver] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closedWidgets, setClosedWidgets] = useState<Set<string>>(new Set());
  
  const inputRef = useRef<HTMLInputElement>(null);

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
    document.documentElement.setAttribute('data-layout', layout);
    document.documentElement.setAttribute('data-speed', dataSaver ? 'none' : 'normal');
    document.documentElement.setAttribute('data-size', fontSize);
    
    if (dataSaver) {
        document.documentElement.classList.add('data-saver');
    } else {
        document.documentElement.classList.remove('data-saver');
    }
  }, [look, layout, fontSize, dataSaver]);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const injectPrompt = (prompt: string) => {
    setIsChatMode(true); // Enter Chat Mode
    setQuery(prompt);
    setResponse(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleInitialize = () => {
    setIsChatMode(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleExportChat = () => {
    const text = history.map(h => `User: ${h.query}\nAI (${h.model}): ${h.response}\n\n`).join('---\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roovert-chat-${new Date().toISOString()}.txt`;
    a.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || isProcessing) {
      return;
    }

    setIsChatMode(true);
    setIsProcessing(true);
    setResponse(null);
    setStatusNote(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          model: selectedModel.apiId,
          systemPrompt: systemPrompt || undefined
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.response) {
        throw new Error(data?.error || data?.warning || 'Failed to process query');
      }

      setResponse(data.response);
      setStatusNote(data.warning ?? (data.simulated ? 'Simulation mode active' : null));
      setHistory(prev => [
        ...prev,
        { query: trimmedQuery, response: data.response, model: selectedModelId },
      ]);
      setQuery('');
    } catch (error: any) {
      console.error('Query failed:', error);
      const fallbackMessage = error?.message || 'Upstream unavailable. Check OpenRouter connectivity.';
      setResponse(`System notice: ${fallbackMessage}`);
      setStatusNote('Simulation mode engaged — verify environment keys.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500 flex flex-col">
        {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)] transition-all duration-500 ${focusMode ? 'opacity-0 hover:opacity-100 pointer-events-none hover:pointer-events-auto' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setIsChatMode(false)} 
                className="text-2xl font-bold bg-gradient-to-r from-[var(--foreground)] to-[var(--accent)] bg-clip-text text-transparent hover:opacity-80 transition-opacity"
              >
                ROOVERT
              </button>
              <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] transition-all text-xs text-[var(--muted)] hover:text-[var(--accent)]"
                >
                    <Settings className="w-3 h-3" />
                    <span>Config</span>
                </button>
                <NavClock />
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              {['Mission', 'Research', 'API', 'Careers'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            currentTheme={theme}
            setTheme={setTheme}
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
            onExportChat={handleExportChat}
            currentLook={look}
            setLook={setLook}
            onOpenLooks={() => setIsLooksOpen(true)}
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

      {!focusMode && <LiveStats />}

      {/* Main Content Area */}
      <main className="theme-shell relative z-10 flex-1 flex flex-col px-6 pt-32 pb-20 overflow-hidden">
        
        {/* Landing Hero (Shown when NOT in Chat Mode) */}
        <AnimatePresence mode="wait">
          {!isChatMode && (
            <motion.div 
              key="hero"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto space-y-12"
            >
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.35em] uppercase text-[var(--foreground)]/50">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
                  Roovert · Engine of Truth
                </div>
                <h1 className="text-6xl md:text-8xl font-light leading-tight">
                  <span className="block">Query the</span>
                  <span className="block text-[var(--accent)] opacity-90">Unfiltered Reality</span>
                </h1>
                <p className="text-xl text-[var(--foreground)]/60 font-light max-w-2xl mx-auto">
                  Advanced intelligence designed to challenge consensus. Powered by <span className="text-[var(--accent)]">{selectedModel.name}</span>.
                </p>
              </div>

              <button
                onClick={handleInitialize}
                className="group relative px-8 py-4 bg-[var(--accent)] text-white text-lg font-medium rounded-full overflow-hidden transition-all hover:scale-105 shadow-[0_0_40px_var(--accent-glow)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative flex items-center gap-3">
                  Initialize Chat <Zap className="w-5 h-5" />
                </span>
              </button>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => injectPrompt(prompt)}
                    className="p-4 text-xs text-left border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Interface (Shown in Chat Mode) */}
        <AnimatePresence>
          {isChatMode && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={`theme-content w-full mx-auto h-full flex flex-col transition-all duration-500 ${isFullscreen ? 'max-w-full px-4' : ''}`}
            >
              <div className="interface-grid h-full">
                {/* Intel Panel (Left) - Hidden in Fullscreen */}
                {!isFullscreen && (
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
                      <span className="text-xs uppercase tracking-[0.35em] text-[var(--foreground)]/50">Active Intelligence</span>
                      <h3 className="font-light">{selectedModel.name}</h3>
                      <p>{selectedModel.description}</p>
                      <button 
                        onClick={() => setIsChatMode(false)}
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
                      <span className="text-xs uppercase tracking-[0.35em] text-[var(--foreground)]/50">Ops Snapshot</span>
                      <div className="mt-4 space-y-4">
                        {SIGNALS.map(signal => (
                          <div key={signal.title}>
                            <p className="text-xs uppercase tracking-[0.45em] text-[var(--foreground)]/40">{signal.title}</p>
                            <p className="text-base mt-1 text-[var(--foreground)]/80">{signal.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
                )}

                {/* Main Chat Stack (Right/Center) */}
                <section className={`chat-stack flex flex-col h-full justify-between transition-all duration-500 ${isFullscreen || (closedWidgets.has('active-intel') && closedWidgets.has('ops-snapshot')) ? 'col-span-full' : ''}`}>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 min-h-[40vh]">
                    {/* Response Area */}
                    <AnimatePresence mode="popLayout">
                      {(response || isProcessing) ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8 shadow-xl mb-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                            </div>
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider font-bold">
                                {isProcessing ? 'Processing Query...' : `Response from ${selectedModel.name}`}
                              </div>
                              {!isProcessing && statusNote && (
                                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.35em]">
                                  {statusNote}
                                </div>
                              )}
                              <div className="prose prose-invert max-w-none">
                                {isProcessing ? (
                                  <div className="flex space-x-1 h-6 items-center">
                                    <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce"></div>
                                  </div>
                                ) : (
                                  <p className="text-[var(--foreground)] text-lg leading-relaxed whitespace-pre-wrap font-light">
                                    {response}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--muted)] opacity-50">
                          <Zap className="w-12 h-12 mb-4" />
                          <p>Ready to query.</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Input Deck */}
                  <div className="command-deck w-full mt-6">
                    <form onSubmit={handleSubmit} className="relative">
                      <div className="glass-panel relative bg-[var(--panel-bg)] backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-4 shadow-2xl hover:border-[var(--accent)]/30 transition-all duration-300">
                        <div className="flex items-center gap-4">
                          {/* Inline Model Selector */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--accent)] text-sm font-medium"
                            >
                              <Zap className="w-4 h-4" />
                              <span className="hidden sm:inline">{selectedModel.name}</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <AnimatePresence>
                              {isModelMenuOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--hud-bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-20 max-h-64 overflow-y-auto custom-scrollbar"
                                >
                                  {MODELS.map(model => (
                                    <button
                                      key={model.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedModelId(model.id);
                                        setIsModelMenuOpen(false);
                                      }}
                                      className={`w-full text-left px-4 py-3 text-xs transition-colors hover:bg-[var(--surface-strong)] flex items-center justify-between ${
                                        selectedModelId === model.id ? 'text-[var(--accent)] bg-[var(--surface)]' : 'text-[var(--foreground)]'
                                      }`}
                                    >
                                      {model.name}
                                      {selectedModelId === model.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Fullscreen Toggle */}
                          <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                          >
                            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                          </button>

                          <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Ask ${selectedModel.name} anything...`}
                            className="flex-1 bg-transparent border-none outline-none text-[var(--foreground)] text-xl placeholder:text-[var(--foreground)]/30 transition-colors font-light"
                            disabled={isProcessing}
                          />
                          <button
                            type="submit"
                            disabled={!query.trim() || isProcessing}
                            className="p-3 bg-[var(--accent)] hover:opacity-90 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[var(--accent)]/20"
                          >
                            {isProcessing ? (
                              <Zap className="w-5 h-5 text-white animate-spin" />
                            ) : (
                              <Send className="w-5 h-5 text-white" />
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                    <Widgets />
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Expanded Sections (Only on Landing) */}
      {!isChatMode && (
        <>
          <section id="mission" className="relative z-10 py-32 border-t border-[var(--border)] bg-black/20">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="text-4xl font-light mb-8">Our Mission</h2>
              <p className="text-xl text-[var(--foreground)]/70 font-light leading-relaxed">
                In an era of curated realities and algorithmic bias, truth has become a scarcity.
                Roovert exists to reverse this entropy. We are building the world's most rigorous
                AI engine, designed not to please, but to <span className="text-[var(--accent)]">understand</span>.
              </p>
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
