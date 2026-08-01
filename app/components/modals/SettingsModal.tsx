'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, X, Monitor, Eye, EyeOff, Zap, Download, Save, Trash2 } from 'lucide-react';
import { type Model } from '../../lib/models';
import { LAYOUTS } from '../../lib/looks';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { RESPONSE_STYLES, type ResponseStyle } from '../../lib/prompts';

// Saved custom-system-prompt presets, kept entirely local to this modal -
// they're just a convenience for recalling values into the single active
// "Custom System Prompt" textarea below, so they don't need to be threaded
// through page.tsx state.
const PRESETS_STORAGE_KEY = 'roovert_prompt_presets';

interface PromptPreset {
  id: string;
  name: string;
  prompt: string;
}

function loadPresets(): PromptPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt/unparseable saved data - ignore it and start fresh instead of
    // crashing the modal.
    return [];
  }
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelId: string;
  setModelId: (id: string) => void;
  layout: string;
  setLayout: (layout: string) => void;
  fontSize: string;
  setFontSize: (size: string) => void;
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
  focusMode: boolean;
  setFocusMode: (value: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (value: string) => void;
  responseStyle: ResponseStyle;
  setResponseStyle: (value: ResponseStyle) => void;
  onExportChat: () => void;
  neuralNoiseEnabled: boolean;
  setNeuralNoiseEnabled: (value: boolean) => void;
  showVisualizerButton: boolean;
  setShowVisualizerButton: (value: boolean) => void;
  availableModels: Model[];
}

export function SettingsModal({
  isOpen,
  onClose,
  currentModelId, setModelId,
  layout, setLayout,
  fontSize, setFontSize,
  dataSaver, setDataSaver,
  focusMode, setFocusMode,
  systemPrompt, setSystemPrompt,
  responseStyle, setResponseStyle,
  onExportChat,
  neuralNoiseEnabled,
  setNeuralNoiseEnabled,
  showVisualizerButton,
  setShowVisualizerButton,
  availableModels = [],
}: SettingsModalProps) {
  useModalDismiss(isOpen, onClose);

  // Saved prompt presets + the name typed into the "save current prompt as"
  // field. Loaded lazily from localStorage on mount - this modal only ever
  // mounts client-side (parent renders it conditionally on isOpen), so
  // there's no SSR/hydration concern here.
  const [presets, setPresets] = useState<PromptPreset[]>(loadPresets);
  const [presetNameDraft, setPresetNameDraft] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // Quota exceeded or storage unavailable - persistence is best-effort
      // and must never crash the modal.
    }
  }, [presets]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLayout('standard');
    setFontSize('normal');
    setDataSaver(false);
    setFocusMode(false);
    setSystemPrompt('');
    setResponseStyle('normal');
    setModelId('ooverta');
    setNeuralNoiseEnabled(false);
    setShowVisualizerButton(false);
  };

  const handleSavePreset = () => {
    const name = presetNameDraft.trim();
    if (!name || !systemPrompt.trim()) return;
    const newPreset: PromptPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      prompt: systemPrompt,
    };
    setPresets((prev) => [...prev, newPreset]);
    setPresetNameDraft('');
  };

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden max-h-[85vh] flex flex-col text-[var(--foreground)]"
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 id="settings-modal-title" className="serif-display text-xl flex items-center gap-2.5 text-[var(--foreground)]">
            <Settings className="w-5 h-5 text-[var(--accent)]" />
            Settings
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface)]"
            >
              Reset Defaults
            </button>
            <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>

          {/* Layout Section - Structure Only */}
          <section>
            <h3 className="label mb-4 pb-2 border-b border-[var(--border)]">Layout</h3>
            <div className="grid grid-cols-3 gap-2">
              {LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${layout === l.id
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
            <h3 className="label mb-4 pb-2 border-b border-[var(--border)]">Appearance & Style</h3>
            <div className="grid gap-8">
              <div>
                <h4 className="label mb-2">Text Size</h4>
                <div className="flex gap-2">
                  {['small', 'normal', 'large'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${fontSize === size
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
            <h3 className="label mb-4 flex items-center gap-2">
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
                  className={`relative w-11 h-6 rounded-full transition-colors ${dataSaver ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
                    }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${dataSaver ? 'translate-x-5' : 'translate-x-0'
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
                  className={`p-2 rounded-lg border transition-colors ${focusMode ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                    }`}
                >
                  {focusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    Neural Background
                    {neuralNoiseEnabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">ACTIVE</span>}
                  </div>
                  <div className="text-xs text-[var(--muted)]">Animated neural network background effect</div>
                </div>
                <button
                  onClick={() => setNeuralNoiseEnabled(!neuralNoiseEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${neuralNoiseEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
                    }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${neuralNoiseEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    Audio-Reactive Visualizer
                    {showVisualizerButton && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">ACTIVE</span>}
                  </div>
                  <div className="text-xs text-[var(--muted)]">Show the visualizer toggle in the navigation bar</div>
                </div>
                <button
                  onClick={() => setShowVisualizerButton(!showVisualizerButton)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showVisualizerButton ? 'bg-[var(--accent)]' : 'bg-[var(--surface-strong)]'
                    }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${showVisualizerButton ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>
            </div>
          </section>

          {/* AI Configuration */}
          <section className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <h3 className="label mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Model Behavior
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="label">Response Style</h4>
                <div className="grid grid-cols-4 gap-2">
                  {RESPONSE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setResponseStyle(style.id)}
                      className={`px-2 py-2 text-xs rounded-lg border transition-colors ${responseStyle === style.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Adjusts how responses are written. Works alongside the custom system prompt below.
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="system-prompt" className="label">Custom System Prompt</label>
                <textarea
                  id="system-prompt"
                  name="system-prompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="e.g., 'You are a pirate...' or 'Explain like I'm 5'"
                  className="w-full h-24 bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 text-sm resize-none focus:border-[var(--accent)] outline-none"
                  aria-label="Custom system prompt"
                />
              </div>

              <div className="space-y-2">
                <h4 className="label">Saved Presets</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetNameDraft}
                    onChange={(e) => setPresetNameDraft(e.target.value)}
                    placeholder="Preset name"
                    aria-label="New preset name"
                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none"
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!presetNameDraft.trim() || !systemPrompt.trim()}
                    title="Save current prompt as a preset"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] hover:bg-[var(--surface)] text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[var(--surface-strong)]"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
                {presets.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]"
                      >
                        <button
                          onClick={() => setSystemPrompt(preset.prompt)}
                          title={preset.prompt}
                          className="flex-1 min-w-0 text-left text-sm text-[var(--foreground)] hover:text-[var(--accent)] transition-colors truncate"
                        >
                          {preset.name}
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          aria-label={`Delete preset ${preset.name}`}
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {presets.length === 0 && (
                  <div className="text-xs text-[var(--muted)]">
                    No saved presets yet. Type a prompt above, name it, and save it for later.
                  </div>
                )}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="label">Default Model</h3>
            </div>
            <div className="grid gap-2">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setModelId(model.id)}
                  className={`card-hover flex items-center justify-between p-4 rounded-xl border transition-all ${currentModelId === model.id
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[var(--border)] bg-[var(--surface)]'
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
