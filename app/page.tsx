'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, TrendingUp, Zap, CheckCircle2 } from 'lucide-react';

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
    // Unique Visitor Logic
    const visitorKey = 'roovert_visitor_id';
    if (typeof window !== 'undefined' && !localStorage.getItem(visitorKey)) {
      // Mark this device as visited
      localStorage.setItem(visitorKey, Date.now().toString());
      // In a real DB implementation, call POST /api/visit here
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
    const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
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
                <span className="text-[#008080] font-mono font-bold">
                  {stats.uniqueMinds.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Queries</span>
                <span className="text-[#008080] font-mono font-bold">
                  {stats.queriesProcessed.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Active</span>
                <span className="text-[#008080] font-mono font-bold">
                  {stats.activeUsers.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70">Accuracy</span>
                <span className="text-[#008080] font-mono font-bold">{stats.accuracy}%</span>
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
        <div className="w-2 h-2 rounded-full bg-[#008080] animate-pulse"></div>
        <span className="text-xs text-white/80 uppercase tracking-wider font-mono">
          System Status {isExpanded ? '[-]' : '[+]'}
        </span>
      </motion.button>
    </div>
  );
}

// Interactive Query Interface
function QueryInterface() {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isProcessing) return;

    setIsProcessing(true);
    setResponse(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setResponse(data.response);
      setHistory(prev => [{ query, response: data.response }, ...prev.slice(0, 4)]);
      setQuery('');
    } catch (error) {
      setResponse('Error processing query. Please try again.');
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Input */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl hover:border-white/20 transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-[#008080]" />
            <span className="text-sm text-white/60 uppercase tracking-wider font-mono">
              Query Reality
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything... The truth awaits."
              className="flex-1 bg-transparent border-none outline-none text-white text-xl placeholder:text-white/30 focus:placeholder:text-white/10 transition-colors font-light"
              disabled={isProcessing}
            />
            <motion.button
              type="submit"
              disabled={!query.trim() || isProcessing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-[#008080] hover:bg-[#009999] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Zap className="w-5 h-5 text-white" />
                </motion.div>
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </motion.button>
          </div>
        </div>
      </motion.form>

      {/* Response Display */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 backdrop-blur-xl border border-[#008080]/30 rounded-2xl p-6"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#008080] mt-1 flex-shrink-0" />
              <p className="text-white/90 font-light leading-relaxed">{response}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Query History */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <h3 className="text-sm text-white/60 uppercase tracking-wider font-mono mb-4">
            Recent Queries
          </h3>
          <div className="space-y-2">
            {history.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white/5 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
              >
                <p className="text-white/70 text-sm mb-1 font-mono">Q: {item.query}</p>
                <p className="text-white/50 text-xs">{item.response}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Feature Cards
function FeatureCards() {
  const features = [
    {
      icon: Sparkles,
      title: 'Rigorous Analysis',
      description: 'Every query undergoes systematic truth-seeking protocols.',
    },
    {
      icon: TrendingUp,
      title: 'Real-Time Processing',
      description: 'Instant responses powered by advanced reasoning engines.',
    },
    {
      icon: Zap,
      title: 'Unfiltered Truth',
      description: 'No censorship. No bias. Just the raw pursuit of understanding.',
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6 mt-20">
      {features.map((feature, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + idx * 0.1 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-[#008080]/50 transition-all duration-300"
        >
          <feature.icon className="w-8 h-8 text-[#008080] mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
          <p className="text-white/60 text-sm leading-relaxed">{feature.description}</p>
        </motion.div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505] text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#008080]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#008080]/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-2xl border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-2xl font-bold bg-gradient-to-r from-white to-[#008080] bg-clip-text text-transparent"
            >
              ROOVERT
            </motion.div>
            <div className="flex items-center gap-8">
              {['Mission', 'Research', 'API', 'Careers'].map((item, idx) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 * idx }}
                  whileHover={{ scale: 1.05 }}
                  className="text-sm text-white/70 hover:text-[#008080] transition-colors uppercase tracking-wider"
                >
                  {item}
                </motion.a>
              ))}
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Live Stats */}
      <LiveStats />

      {/* Hero Section */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-32 pb-20">
        <div className="w-full max-w-6xl mx-auto space-y-16">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6"
          >
            <h1 className="text-7xl md:text-9xl font-light leading-tight">
              <span className="block text-white">Roovert</span>
              <span className="block bg-gradient-to-r from-white via-[#008080] to-white bg-clip-text text-transparent">
                The Truth, Unfiltered
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/60 font-light max-w-2xl mx-auto">
              Rigorously pursuing truth through advanced AI. 
              <span className="text-[#008080]"> No filters. No bias. Just reality.</span>
            </p>
          </motion.div>

          {/* Query Interface */}
          <QueryInterface />

          {/* Feature Cards */}
          <FeatureCards />
        </div>
      </main>

      {/* Mission Section */}
      <section id="mission" className="relative z-10 py-32 border-t border-white/5 bg-black/20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl md:text-5xl font-light">Our Mission</h2>
            <div className="space-y-6 text-lg text-white/70 font-light leading-relaxed">
              <p>
                In an era of curated realities and algorithmic bias, truth has become a scarcity.
                Roovert exists to reverse this entropy. We are building the world's most rigorous
                AI engine, designed not to please, but to <span className="text-[#008080]">understand</span>.
              </p>
              <p>
                Our models are trained on first principles, rejecting the consensus in favor of
                verifiable reality. We don't just process data; we interrogate it.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Research Section */}
      <section id="research" className="relative z-10 py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-light mb-6">Research Frontiers</h2>
            <p className="text-white/60 text-lg max-w-2xl">
              We are pushing the boundaries of what's possible in artificial reasoning and
              autonomous verification.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Autonomous Fact Verification",
                desc: "Systems that independently verify claims against primary sources in real-time.",
                status: "Deployment"
              },
              {
                title: "Bias Detection & Elimination",
                desc: "Algorithmic approaches to identifying and neutralizing training data bias.",
                status: "Beta"
              },
              {
                title: "Causal Reasoning Engines",
                desc: "Moving beyond correlation to understand the 'why' behind the data.",
                status: "Research"
              },
              {
                title: "Semantic Truth Mapping",
                desc: "Mapping the relationship between linguistic assertions and physical reality.",
                status: "Prototype"
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group p-8 border border-white/10 rounded-2xl hover:border-[#008080]/30 hover:bg-white/5 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-medium group-hover:text-[#008080] transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-xs font-mono px-2 py-1 rounded bg-white/5 text-white/40 border border-white/5">
                    {item.status}
                  </span>
                </div>
                <p className="text-white/60 font-light leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="relative z-10 border-t border-white/10 py-8"
      >
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-white/40 text-sm">
            © 2026 Roovert. Rigorously Pursuing Truth.
          </p>
        </div>
      </motion.footer>
    </div>
  );
}
