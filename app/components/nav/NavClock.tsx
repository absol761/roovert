'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function NavClock() {
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
