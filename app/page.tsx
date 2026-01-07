'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Zap, Settings, X, Globe, Cloud } from 'lucide-react';

const MODELS = [
  { id: 'ooverta', name: 'Ooverta (Default)', apiId: 'ooverta', category: 'Standard', description: 'The engine of truth. Web-aware.' },
  { id: 'mistral-7b', name: 'Mistral 7B', apiId: 'mistralai/mistral-7b-instruct', category: 'Standard', description: 'Fast, efficient, open.' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', apiId: 'deepseek/deepseek-chat', category: 'Standard', description: 'High reasoning capability.' },
  { id: 'gpt-4o', name: 'GPT-4o', apiId: 'openai/gpt-4o', category: 'Advanced', description: 'Top-tier general intelligence.' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', apiId: 'anthropic/claude-3.5-sonnet', category: 'Advanced', description: 'Nuanced and articulate.' },
  { id: 'perplexity', name: 'Perplexity', apiId: 'perplexity/llama-3-sonar-large-32k-online', category: 'Advanced', description: 'Real-time search engine.' },
];

const THEMES = [
  { id: 'default', name: 'Deep Space', color: '#008080' },
  { id: 'obsidian', name: 'Obsidian', color: '#8b5cf6' },
  { id: 'midnight', name: 'Midnight', color: '#38bdf8' },
  { id: 'aether', name: 'Aether Field', color: '#6366f1' },
  { id: 'nocturne', name: 'Nocturne Circuit', color: '#f97316' },
  { id: 'atlas', name: 'Atlas Grid', color: '#16a34a' },
  { id: 'minimal', name: 'Clean Slate', color: '#e4e4e7' },
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

// Settings Modal Component
function SettingsModal({ isOpen, onClose, currentTheme, setTheme, currentModelId, setModelId }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col text-[var(--foreground)]"
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-light tracking-wide flex items-center gap-2 text-[var(--foreground)]">
            <Settings className="w-5 h-5 text-[var(--accent)]" />
            System Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* Theme Section */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono">Interface Theme</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    currentTheme === theme.id 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.color }} />
                  <span className="text-sm font-medium text-[var(--foreground)]">{theme.name}</span>
                </button>
              ))}
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
  const [weather, setWeather] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/weather').then(res => res.json()).then(setWeather).catch(() => {});
    fetch('/api/news').then(res => res.json()).then(setNews).catch(() => {});
  }, []);

  return (
    <div className="widgets-stack flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
      {/* Weather Widget */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="widget-card flex-shrink-0 min-w-[220px] p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] backdrop-blur-md"
      >
        <div className="flex items-center gap-2 mb-2 text-[var(--muted)]">
          <Cloud className="w-4 h-4" />
          <span className="text-xs uppercase font-mono">Atmosphere</span>
        </div>
        {weather ? (
          <div>
            <div className="text-2xl font-light">{weather.temp}°C</div>
            <div className="text-xs text-[var(--muted)]">Wind: {weather.wind} km/h</div>
          </div>
        ) : (
          <div className="h-8 w-24 bg-[var(--surface-strong)] rounded animate-pulse" />
        )}
      </motion.div>

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
    // Unique Visitor Logic (Real Count)
    const visitorKey = 'roovert_visitor_id';
    if (typeof window !== 'undefined' && !localStorage.getItem(visitorKey)) {
      localStorage.setItem(visitorKey, Date.now().toString());
      // Trigger real counter increment
      fetch('/api/visit', { method: 'POST' }).catch(() => {});
    }

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
                <span className="text-[var(--muted)]">Unique Minds</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {stats.uniqueMinds.toLocaleString()}
                </span>
              </div>
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

export default function Home() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: string; model: string }>>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('default');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const injectPrompt = (prompt: string) => {
    setQuery(prompt);
    setResponse(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setResponse(null);
    setStatusNote(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query,
          model: selectedModel.apiId 
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setResponse(data.response);
      setStatusNote(data.warning || null);
      setHistory(prev => [{ query, response: data.response, model: selectedModel.name }, ...prev.slice(0, 4)]);
      setQuery('');
    } catch (error: any) {
      console.error('Frontend Query Error:', error);
      setResponse(`System Alert: ${error.message || 'Connection interrupted.'}`);
      setStatusNote(null);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-2xl font-bold bg-gradient-to-r from-[var(--foreground)] to-[var(--accent)] bg-clip-text text-transparent">
                ROOVERT
              </div>
              {/* Settings Trigger */}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] transition-all text-xs text-[var(--muted)] hover:text-[var(--accent)]"
              >
                <Settings className="w-3 h-3" />
                <span>Config</span>
              </button>
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
          />
        )}
      </AnimatePresence>

      <LiveStats />

      {/* Main Content */}
      <main className="theme-shell relative z-10 min-h-screen px-6 pt-32 pb-20">
        <div className="theme-content w-full max-w-6xl mx-auto space-y-14">
          {/* Headline */}
          <div className="hero-stack">
            <div className="space-y-6 text-left w-full">
              <div className="inline-flex items-center gap-2 text-xs font-mono tracking-[0.35em] uppercase text-[var(--foreground)]/50">
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
                Roovert · Engine of Truth
              </div>
              <h1 className="text-5xl md:text-7xl font-light leading-tight">
                Intelligence that challenges every claim.
              </h1>
              <p className="text-lg md:text-xl text-[var(--foreground)]/70 max-w-3xl">
                Designed to feel like the tools that power Gemini, ChatGPT, and Grok—minimal,
                kinetic, and brutally honest. Choose a model, interrogate reality, and get instant synthesis.
              </p>
              <div className="flex flex-wrap gap-6 text-xs md:text-sm uppercase tracking-[0.35em] text-[var(--foreground)]/50">
                <span>Active Model · <span className="text-[var(--accent)]">{selectedModel.name}</span></span>
                <span>Signal Integrity · 99.99%</span>
                <span>Latency · Real-time</span>
              </div>
            </div>
          </div>

          <div className="interface-grid">
            <section className="intel-panel">
              <div className="intel-card">
                <span className="text-xs uppercase tracking-[0.35em] text-[var(--foreground)]/50">Active Intelligence</span>
                <h3 className="font-light">{selectedModel.name}</h3>
                <p>{selectedModel.description}</p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {QUICK_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => injectPrompt(prompt)}
                      className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[10px] font-mono tracking-[0.25em] uppercase hover:border-[var(--accent)]/60 hover:text-[var(--accent)] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="intel-card">
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
            </section>

            <section className="chat-stack">
              <div className="command-deck w-full">
                <form onSubmit={handleSubmit} className="relative">
                  <div className="glass-panel relative bg-[var(--panel-bg)] backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-6 shadow-2xl hover:border-[var(--accent)]/30 transition-all duration-300">
                    <div className="flex items-center gap-4">
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

                {/* Response Area */}
                <AnimatePresence>
                  {(response || isProcessing) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="glass-panel mt-6 bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8 shadow-xl"
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
                  )}
                </AnimatePresence>
              </div>

              {history.length > 0 && (
                <div className="history-feed">
                  <div className="text-xs uppercase tracking-[0.35em] text-[var(--foreground)]/40">Recent transmissions</div>
                  {history.map((item, idx) => (
                    <div key={`${item.query}-${idx}`} className="history-item">
                      <span>{item.model}</span>
                      <p>{item.query}</p>
                      <p className="text-xs text-[var(--foreground)]/50 mt-1">{item.response}</p>
                    </div>
                  ))}
                </div>
              )}

              <Widgets />
            </section>
          </div>
        </div>
      </main>

      {/* Expanded Sections */}
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-8 text-center text-[var(--foreground)]/40 text-sm">
        <p>© 2026 Roovert. Rigorously Pursuing Truth.</p>
      </footer>
    </div>
  );
}
