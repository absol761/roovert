'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles } from 'lucide-react';

interface VisualizerSelectorProps {
  currentMode: string;
  onModeChange: (mode: string) => void;
}

const VISUALIZERS = [
  { id: 'sphere', name: 'Sphere', description: 'Simple wireframe sphere' },
  { id: 'horse', name: 'Horse', description: 'Animated horse model' },
  { id: 'treadmill', name: 'Treadmill', description: 'Moving treadmill belt' },
  { id: 'grid', name: 'Grid', description: 'Audio-reactive grid' },
  { id: 'particles', name: 'Particles', description: 'Particle system' },
  { id: 'waves', name: 'Waves', description: 'Wave visualization' },
];

export function VisualizerSelector({ currentMode, onModeChange }: VisualizerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentVisualizer = VISUALIZERS.find(v => v.id === currentMode) || VISUALIZERS[0];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center justify-center w-12 h-12 rounded-full bg-black/90 backdrop-blur-md hover:bg-black border-2 border-cyan-500/70 hover:border-cyan-400 transition-all text-cyan-400 font-medium shadow-lg shadow-cyan-500/30 group hover:scale-110"
        title="Visualizer Options"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-180 transition-transform duration-300" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-64 bg-black/90 backdrop-blur-sm border border-cyan-500/50 rounded-xl shadow-xl shadow-cyan-500/20 overflow-hidden z-[9999]"
            >
              <div className="p-2">
                {VISUALIZERS.map((visualizer) => (
                  <button
                    key={visualizer.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModeChange(visualizer.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      currentMode === visualizer.id
                        ? 'bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-500'
                        : 'hover:bg-cyan-500/10 text-cyan-300'
                    }`}
                  >
                    <div className="font-medium">{visualizer.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      {visualizer.description}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
