'use client';

import { useState, useEffect } from 'react';

// Live Mission Clock Component
function LiveMissionClock() {
  const [time, setTime] = useState('00:00:00:00');
  
  useEffect(() => {
    // Placeholder calculation for "Time to AGI"
    const calculateTimeToAGI = () => {
      const now = new Date();
      const targetDate = new Date('2030-01-01'); // Placeholder target
      const diff = targetDate.getTime() - now.getTime();
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    
    setTime(calculateTimeToAGI());
    const interval = setInterval(() => {
      setTime(calculateTimeToAGI());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-[#050505]/80 backdrop-blur-md border border-[#008080]/30 rounded-lg px-4 py-2">
        <div className="text-xs text-[#008080]/60 uppercase tracking-wider mb-1">Time to AGI</div>
        <div className="font-mono text-lg text-[#008080] font-bold tabular-nums">{time}</div>
      </div>
    </div>
  );
}

// Verified Quote Feed Component
function VerifiedQuoteFeed() {
  const quotes = [
    { id: 1, text: "Truth is not a destination, it's a direction.", verified: true },
    { id: 2, text: "Every query is a step closer to understanding.", verified: true },
    { id: 3, text: "Rigor requires courage.", verified: true },
    { id: 4, text: "The unfiltered path is the only path.", verified: true },
    { id: 5, text: "Reality doesn't negotiate.", verified: true },
  ];
  
  const [displayedQuotes, setDisplayedQuotes] = useState<typeof quotes>([]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
      setDisplayedQuotes(prev => {
        const newQuotes = [...prev, { ...randomQuote, id: Date.now() }];
        return newQuotes.slice(-3); // Keep only last 3
      });
    }, 3000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 h-32 overflow-hidden pointer-events-none z-40">
      <div className="relative h-full">
        {displayedQuotes.map((quote, index) => (
          <div
            key={quote.id}
            className="absolute w-full text-center"
            style={{
              animation: `stream-flow 8s linear ${index * 2}s forwards`,
              bottom: `${index * 40}px`,
            }}
          >
            <div className="inline-flex items-center gap-2 bg-[#050505]/90 backdrop-blur-sm border border-[#008080]/20 rounded-full px-4 py-2">
              {quote.verified && (
                <svg className="w-4 h-4 text-[#008080]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm text-white/80 font-medium">{quote.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  
  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-md border-b border-[#008080]/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-[#008080]">ROOVERT</div>
            <div className="flex items-center gap-8">
              <a href="#mission" className="text-sm text-white/70 hover:text-[#008080] transition-colors uppercase tracking-wider">Mission</a>
              <a href="#research" className="text-sm text-white/70 hover:text-[#008080] transition-colors uppercase tracking-wider">Research</a>
              <a href="#api" className="text-sm text-white/70 hover:text-[#008080] transition-colors uppercase tracking-wider">API</a>
              <a href="#careers" className="text-sm text-white/70 hover:text-[#008080] transition-colors uppercase tracking-wider">Careers</a>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Live Mission Clock */}
      <LiveMissionClock />
      
      {/* Hero Section */}
      <main className="flex min-h-screen items-center justify-center px-6 pt-24 pb-32">
        <div className="max-w-4xl w-full text-center space-y-12">
          {/* Kinetic Typography Headline */}
          <h1 
            className="text-6xl md:text-8xl font-bold leading-tight"
            style={{
              animation: 'kinetic-pulse 3s ease-in-out infinite',
              textShadow: '0 0 40px rgba(0, 128, 128, 0.5), 0 0 80px rgba(0, 128, 128, 0.3)',
            }}
          >
            <span className="text-white">Roovert:</span>
            <br />
            <span className="text-[#008080]">The Truth, Unfiltered.</span>
          </h1>
          
          {/* Glassmorphic Input Command Line */}
          <div className="relative max-w-2xl mx-auto">
            <div 
              className="relative bg-[#050505]/40 backdrop-blur-xl border border-[#008080]/30 rounded-2xl p-6 shadow-2xl"
              style={{
                animation: 'glow-pulse 4s ease-in-out infinite',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#008080] animate-pulse"></div>
                <span className="text-xs text-[#008080]/60 uppercase tracking-wider font-mono">Query the Reality</span>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your command..."
                className="w-full bg-transparent border-none outline-none text-white text-lg font-mono placeholder:text-white/30 focus:placeholder:text-white/10 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    // Handle query submission
                    console.log('Query:', query);
                  }
                }}
              />
              <div className="absolute bottom-2 right-4 text-xs text-[#008080]/40 font-mono">
                Press Enter to execute
              </div>
            </div>
          </div>
          
          {/* Subheading */}
          <p className="text-xl text-white/60 max-w-2xl mx-auto font-light">
            Rigorously Pursuing Truth. Your AI isn't just a helper—it's an <span className="text-[#008080] font-semibold">Engine of Truth</span>.
          </p>
        </div>
      </main>
      
      {/* Verified Quote Feed */}
      <VerifiedQuoteFeed />
      
      {/* Add styles for animations */}
      <style jsx>{`
        @keyframes kinetic-pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.01);
          }
        }
        
        @keyframes stream-flow {
          0% {
            transform: translateY(100%);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100%);
            opacity: 0;
          }
        }
        
        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 128, 128, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 128, 128, 0.5), 0 0 60px rgba(0, 128, 128, 0.3);
          }
        }
      `}</style>
    </div>
  );
}
