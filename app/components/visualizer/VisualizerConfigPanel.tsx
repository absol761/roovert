'use client';

import { motion } from 'framer-motion';
import { X, ChevronDown, Waves, Square, MapPin, TriangleAlert, Sparkles } from 'lucide-react';
import type { VisualizerMode } from './R3FVisualizer';
import type { MicStatus } from '../../hooks/useMicLevel';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { EASE_OUT } from '../../lib/motion';

const PALETTES: [string, string][] = [
  ['#4a90e2', '#7b68ee'], ['#ff6b35', '#00d4ff'], ['#ff4757', '#5352ed'],
  ['#2ed573', '#1e90ff'], ['#ffa502', '#ff6348'], ['#5f27cd', '#00d2d3'],
  ['#ee5a6f', '#c44569'], ['#00d2ff', '#3a7bd5'], ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'],
  ['#30cfd0', '#330867'], ['#a8edea', '#fed6e3'], ['#ff9a9e', '#fecfef'],
  ['#ffecd2', '#fcb69f'],
];

const MODE_OPTIONS: { value: VisualizerMode; label: string; icon: typeof Waves }[] = [
  { value: 'orb', label: 'ORB', icon: Sparkles },
  { value: 'wave_form', label: 'WAVE_FORM', icon: Waves },
  { value: 'grid', label: 'GRID', icon: Square },
  { value: 'plane', label: 'PLANE', icon: Square },
  { value: 'manhattan', label: 'MANHATTAN', icon: MapPin },
];

interface VisualizerConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  micStatus?: MicStatus;
  mode: VisualizerMode;
  onModeChange: (mode: VisualizerMode) => void;
  onColor1Change: (color: string) => void;
  onColor2Change: (color: string) => void;
  onReset: () => void;
  waveFormPreset: 'default' | 'custom';
  onWaveFormPresetChange: (preset: 'default' | 'custom') => void;
  waveFormDouble: boolean;
  onWaveFormDoubleChange: (double: boolean) => void;
  maxAmplitude: number;
  onMaxAmplitudeChange: (amplitude: number) => void;
  waveFreq: number;
  onWaveFreqChange: (freq: number) => void;
  colorBackground: boolean;
  onColorBackgroundChange: (enabled: boolean) => void;
  colorsFollowMusic: boolean;
  onColorsFollowMusicChange: (enabled: boolean) => void;
  autoOrbit: boolean;
  onAutoOrbitChange: (enabled: boolean) => void;
  gridPreset: 'default' | 'bands' | 'custom';
  onGridPresetChange: (preset: 'default' | 'bands' | 'custom') => void;
  selectedPalette: number;
  onSelectedPaletteChange: (index: number) => void;
}

export function VisualizerConfigPanel({
  isOpen,
  onClose,
  enabled,
  onEnabledChange,
  micStatus,
  mode,
  onModeChange,
  onColor1Change,
  onColor2Change,
  onReset,
  waveFormPreset,
  onWaveFormPresetChange,
  waveFormDouble,
  onWaveFormDoubleChange,
  maxAmplitude,
  onMaxAmplitudeChange,
  waveFreq,
  onWaveFreqChange,
  colorBackground,
  onColorBackgroundChange,
  colorsFollowMusic,
  onColorsFollowMusicChange,
  autoOrbit,
  onAutoOrbitChange,
  gridPreset,
  onGridPresetChange,
  selectedPalette,
  onSelectedPaletteChange,
}: VisualizerConfigPanelProps) {
  useModalDismiss(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visualizer-config-title"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-[var(--hud-bg)]/98 backdrop-blur-xl border-l border-[var(--border)] shadow-2xl overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 id="visualizer-config-title" className="text-lg font-medium text-[var(--foreground)]">Visualizer Config</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-[var(--surface)] rounded transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40 transition-colors"
        >
          <span className="text-left">
            <span className="text-sm font-medium text-[var(--foreground)] block">Audio-Reactive Visualizer</span>
            <span className="text-xs text-[var(--muted)]">Uses your microphone to react to sound</span>
          </span>
          <span
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-[var(--duration-fast)] ${enabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
              }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-[var(--duration-fast)] ${enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </span>
        </button>

        {enabled && (micStatus === 'denied' || micStatus === 'unsupported') && (
          <div className="flex items-start gap-2 -mt-2 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {micStatus === 'denied'
                ? 'Microphone access was blocked, so the visualizer is running on idle motion only. Allow the mic in your browser’s site settings, then toggle this off and on again.'
                : 'This browser doesn’t support microphone input, so the visualizer is running on idle motion only.'}
            </span>
          </div>
        )}

        <div>
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block font-medium">MODE</label>
          <div className="relative">
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as VisualizerMode)}
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] appearance-none cursor-pointer hover:border-[var(--accent)] transition-colors pr-10"
            >
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-[var(--muted)]" />
            </div>
          </div>
        </div>

        {mode === 'wave_form' && (
          <div className="space-y-4 border-t border-[var(--border)] pt-4">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider block font-medium">Wave Form</label>
            <div className="flex gap-2">
              <button
                onClick={() => onWaveFormPresetChange('default')}
                className={`flex-1 px-3 py-2 rounded border text-xs font-medium transition-all ${waveFormPreset === 'default'
                  ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                  }`}
              >
                default
              </button>
              <button
                onClick={() => onWaveFormPresetChange('custom')}
                className={`flex-1 px-3 py-2 rounded border text-xs font-medium transition-all ${waveFormPreset === 'custom'
                  ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                  }`}
              >
                custom
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--muted)]">Double</label>
              <button
                onClick={() => onWaveFormDoubleChange(!waveFormDouble)}
                className={`relative w-12 h-6 rounded-full transition-colors ${waveFormDouble ? 'bg-[var(--accent)]' : 'bg-[var(--surface)] border border-[var(--border)]'
                  }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${waveFormDouble ? 'translate-x-6' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[var(--muted)]">Max Amplitude</label>
                <span className="text-xs text-[var(--muted)] font-mono">{maxAmplitude.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.01"
                value={maxAmplitude}
                onChange={(e) => onMaxAmplitudeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[var(--surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-[var(--muted)] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
                  Wave #1 - Freq (hz)
                </label>
                <span className="text-xs text-[var(--muted)] font-mono">{waveFreq.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.01"
                value={waveFreq}
                onChange={(e) => onWaveFreqChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[var(--surface)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
              />
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-4">
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3 block font-medium">Palette</label>
          <div className="grid grid-cols-4 gap-2">
            {PALETTES.map((palette, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onSelectedPaletteChange(idx);
                  onColor1Change(palette[0]);
                  onColor2Change(palette[1]);
                }}
                className={`relative aspect-square rounded-full border-2 transition-all ${selectedPalette === idx
                  ? 'border-[var(--accent)] scale-110'
                  : 'border-[var(--border)] hover:border-[var(--accent)]'
                  }`}
                style={{
                  background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--muted)]">Color Background</label>
            <button
              onClick={() => onColorBackgroundChange(!colorBackground)}
              className={`relative w-12 h-6 rounded-full transition-colors ${colorBackground ? 'bg-[var(--accent)]' : 'bg-[var(--surface)] border border-[var(--border)]'
                }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${colorBackground ? 'translate-x-6' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--muted)]">Colors Follow Music</label>
            <button
              onClick={() => onColorsFollowMusicChange(!colorsFollowMusic)}
              className={`relative w-12 h-6 rounded-full transition-colors ${colorsFollowMusic ? 'bg-[var(--accent)]' : 'bg-[var(--surface)] border border-[var(--border)]'
                }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${colorsFollowMusic ? 'translate-x-6' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--muted)]">Auto Orbit Camera</label>
            <button
              onClick={() => onAutoOrbitChange(!autoOrbit)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoOrbit ? 'bg-[var(--accent)]' : 'bg-[var(--surface)] border border-[var(--border)]'
                }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoOrbit ? 'translate-x-6' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        {mode === 'grid' && (
          <div className="border-t border-[var(--border)] pt-4">
            <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-3 block font-medium">Grid Presets</label>
            <div className="flex gap-2">
              {(['default', 'bands', 'custom'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => onGridPresetChange(preset)}
                  className={`flex-1 px-3 py-2 rounded border text-xs font-medium transition-all capitalize ${gridPreset === preset
                    ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                    }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-4">
          <button
            onClick={onReset}
            className="w-full px-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all text-sm font-medium"
          >
            Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
}
