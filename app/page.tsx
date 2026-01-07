'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, TrendingUp, Zap, CheckCircle2, ChevronDown, Settings, X, Sun, Moon, Monitor, Globe, BarChart2, Cloud } from 'lucide-react';

const MODELS = [
  { id: 'ooberta', name: 'Ooberta (Default)', apiId: 'ooberta', category: 'Standard', description: 'The engine of truth. Web-aware.' },
  { id: 'mistral-7b', name: 'Mistral 7B', apiId: 'mistralai/mistral-7b-instruct', category: 'Standard', description: 'Fast, efficient, open.' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', apiId: 'deepseek/deepseek-chat', category: 'Standard', description: 'High reasoning capability.' },
  { id: 'gpt-4o', name: 'GPT-4o', apiId: 'openai/gpt-4o', category: 'Advanced', description: 'Top-tier general intelligence.' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', apiId: 'anthropic/claude-3.5-sonnet', category: 'Advanced', description: 'Nuanced and articulate.' },
  { id: 'perplexity', name: 'Perplexity', apiId: 'perplexity/llama-3-sonar-large-32k-online', category: 'Advanced', description: 'Real-time search engine.' },
];

const THEMES = [
  { id: 'default', name: 'Deep Space', color: '#008080' },
  { id: 'cyberpunk', name: 'Neon City', color: '#f700ff' },
  { id: 'matrix', name: 'The Source', color: '#00ff00' },
  { id: 'minimal', name: 'Clean Slate', color: '#000000' },
];

// Settings Modal Component
function SettingsModal({ isOpen, onClose, currentTheme, setTheme, currentModelId, setModelId }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-light tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--accent)]" />
            System Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {/* Theme Section */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-white/40 mb-4 font-mono">Interface Theme</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={`p-3 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    currentTheme === theme.id 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-white/5 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.color }} />
                  <span className="text-sm font-medium">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Model Section */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-white/40 mb-4 font-mono">Default Intelligence</h3>
            <div className="grid gap-2">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setModelId(model.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    currentModelId === model.id 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-white/5 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2">
                      {model.name}
                      {model.category === 'Advanced' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/40">PRO</span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 mt-1">{model.description}</div>
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
    <div className="flex gap-4 mt-8 overflow-x-auto pb-4 custom-scrollbar">
      {/* Weather Widget */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-shrink-0 min-w-[200px] p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 mb-2 text-white/60">
          <Cloud className="w-4 h-4" />
          <span className="text-xs uppercase font-mono">Atmosphere</span>
        </div>
        {weather ? (
          <div>
            <div className="text-2xl font-light">{weather.temp}°C</div>
            <div className="text-xs text-white/40">Wind: {weather.wind} km/h</div>
          </div>
        ) : (
          <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
        )}
      </motion.div>

      {/* News Widget */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-shrink-0 min-w-[300px] max-w-[400px] p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 mb-2 text-white/60">
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
            <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-white/5 rounded animate-pulse" />
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
    activeUsers: 0,
    uniqueMinds: 0,
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
            className="mb-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl min-w-[240px]"
          >
            <div className="space-y-3">
               <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Unique Minds</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {stats.uniqueMinds.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Queries</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {stats.queriesProcessed.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Active</span>
                <span className="text-[var(--accent)] font-mono font-bold">
                  {stats.activeUsers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Accuracy</span>
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
        className="flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-lg hover:bg-black/80 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></div>
        <span className="text-xs text-white/80 uppercase tracking-wider font-mono">
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
  
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('default');
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setResponse(null);

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
      setResponse(data.response);
      setHistory(prev => [{ query, response: data.response, model: selectedModel.name }, ...prev.slice(0, 4)]);
      setQuery('');
    } catch (error) {
      setResponse('Error processing query. Please try again.');
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
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs text-white/60 hover:text-[var(--accent)]"
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
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-32 pb-20">
        <div className="w-full max-w-5xl mx-auto space-y-12">
          {/* Headline */}
          <div className="text-center space-y-6">
            <h1 className="text-6xl md:text-8xl font-light leading-tight">
              <span className="block">Roovert</span>
              <span className="block text-[var(--accent)] opacity-90">
                The Truth, Unfiltered
              </span>
            </h1>
            <p className="text-xl text-[var(--foreground)]/60 font-light max-w-2xl mx-auto">
              Query reality with precision. Powered by <span className="text-[var(--accent)]">{selectedModel.name}</span>.
            </p>
          </div>

          {/* Query Interface */}
          <div className="w-full max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative bg-[var(--panel-bg)] backdrop-blur-2xl border border-[var(--border)] rounded-3xl p-6 shadow-2xl hover:border-[var(--accent)]/30 transition-all duration-300">
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
              {response && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-6 bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8 shadow-xl"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div className="space-y-3 flex-1 min-w-0">
                      <div className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider font-bold">
                        Response from {selectedModel.name}
                      </div>
                      <div className="prose prose-invert max-w-none">
                        <p className="text-[var(--foreground)] text-lg leading-relaxed whitespace-pre-wrap font-light">
                          {response}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Widgets Section */}
            <Widgets />
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
