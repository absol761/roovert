'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Send, Sparkles, Zap, Settings, X, Globe, ChevronDown, Clock, AlertTriangle, RotateCcw, Monitor, Maximize, Minimize, Download, Eye, EyeOff, Palette, Copy, Check, Square, Paperclip, Image as ImageIcon, Edit2, RefreshCw, Search, Code, Users, Star, ArrowRight, Paintbrush, Waves, MapPin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useMobile } from './hooks/useMobile';
import { shouldHideOpenRouterModels } from './lib/rateLimit';
// Removed ConsentBanner import - component doesn't exist
// Removed NeuralNoise and AudioVisualizer imports - not needed for R3F visualizer

interface Model {
  id: string;
  name: string;
  apiId: string;
  category: string;
  description: string;
}

const MODELS: Model[] = [
  { id: 'ooverta', name: 'Ooverta', apiId: 'meta-llama/llama-4-scout-17b-16e-instruct', category: 'Standard', description: 'The flagship Llama 4 model. Multimodal & ultra-precise.' },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', apiId: 'meta-llama/llama-4-scout-17b-16e-instruct', category: 'Standard', description: 'Meta\'s latest mixture-of-experts model.' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', apiId: 'llama-3.3-70b-versatile', category: 'Advanced', description: 'The peak of Llama 3 performance.' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', apiId: 'llama-3.1-8b-instant', category: 'Standard', description: 'Extremely fast and lightweight.' },
];

// OpenRouter Models - Best models available
const OPENROUTER_MODELS: Model[] = [
  { id: 'gpt-4o', name: 'GPT-4o', apiId: 'openai/gpt-4o', category: 'Premium', description: 'OpenAI\'s most advanced model with multimodal capabilities.' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', apiId: 'openai/gpt-4-turbo', category: 'Premium', description: 'Faster and more capable GPT-4 variant.' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', apiId: 'anthropic/claude-3.5-sonnet', category: 'Premium', description: 'Anthropic\'s most capable model for complex reasoning.' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', apiId: 'anthropic/claude-3-opus', category: 'Premium', description: 'Anthropic\'s flagship model for advanced tasks.' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', apiId: 'anthropic/claude-3-sonnet', category: 'Advanced', description: 'Balanced performance and speed from Anthropic.' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', apiId: 'anthropic/claude-3-haiku', category: 'Standard', description: 'Fast and efficient Claude model.' },
  { id: 'gemini-pro', name: 'Gemini Pro', apiId: 'google/gemini-pro', category: 'Advanced', description: 'Google\'s advanced multimodal AI model.' },
  { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', apiId: 'meta-llama/llama-3.1-405b-instruct', category: 'Premium', description: 'Meta\'s largest and most capable open model.' },
  { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', apiId: 'meta-llama/llama-3.1-70b-instruct', category: 'Advanced', description: 'High-performance open-source model from Meta.' },
  { id: 'mistral-large', name: 'Mistral Large', apiId: 'mistralai/mistral-large', category: 'Premium', description: 'Mistral\'s flagship model for complex reasoning.' },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', apiId: 'mistralai/mixtral-8x7b-instruct', category: 'Advanced', description: 'High-quality mixture-of-experts model.' },
  { id: 'qwen-2.5-72b', name: 'Qwen 2.5 72B', apiId: 'qwen/qwen-2.5-72b-instruct', category: 'Advanced', description: 'Alibaba\'s powerful multilingual model.' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', apiId: 'deepseek/deepseek-chat', category: 'Standard', description: 'Fast and efficient reasoning model.' },
];

const MORE_MODELS: Model[] = [];

const QUICK_PROMPTS = [
  'Stress test this assumption about AGI timelines.',
  'Summarize the latest x-risk research with citations.',
  'Cross-check today’s markets sentiment vs macro data.',
  'Explain why the universe favors or rejects life.',
];

const SIGNALS = [
  { title: 'Mission Feed', detail: 'Truth Ops syncing with live telemetry.' },
  { title: 'Signal Integrity', detail: 'All anomalies logged and traced.' },
];

// Layout/Animation Options
const LAYOUTS = [
  { id: 'standard', name: 'Standard' },
  { id: 'compact', name: 'Compact' },
  { id: 'wide', name: 'Spacious' },
];

// Looks - Modern 2025-2026 design trends
const LOOKS = [
  { id: 'neominimal', name: 'Neo-Minimal', description: 'Minimalism with depth and soft shadows', category: 'essential' },
  { id: 'monochrome', name: 'Monochrome', description: 'Soft monochrome design', category: 'essential' },
  { id: 'depth', name: 'Depth Field', description: '3D layers with realistic shadows', category: 'modern' },
  { id: 'bold', name: 'Bold Typography', description: 'Experimental fonts with maximum impact', category: 'modern' },
  { id: 'sustainable', name: 'Sustainable', description: 'Eco-friendly green design palette', category: 'modern' },
  { id: 'accessible', name: 'High Contrast', description: 'Accessible design with WCAG compliance', category: 'modern' },
  { id: 'gemini', name: 'Google Gemini', description: 'Inspired by Gemini colors with smooth animations', category: 'modern' },
  { id: 'nocturne', name: 'Nocturne', description: 'Deep night with orange accents', category: 'dark' },
  { id: 'midnight', name: 'Midnight', description: 'Slate blue with sky accents', category: 'dark' },
  { id: 'aether', name: 'Aether', description: 'Light indigo with split-grid layout', category: 'light' },
  { id: 'atlas', name: 'Atlas', description: 'Brutalist blueprint aesthetic', category: 'light' },
  { id: 'earthtone', name: 'Earthtone', description: 'Natural earth colors with warm palette', category: 'themed' },
  { id: 'retrowave', name: 'Retrowave', description: 'Synthwave 80s aesthetic', category: 'themed' },
  { id: 'space', name: 'Deep Space', description: 'Cosmic darkness with stars', category: 'themed' },
  { id: 'textured-velvet', name: 'Textured Velvet', description: 'Rich velvet textures with deep colors', category: 'textured' },
  { id: 'textured-marble', name: 'Textured Marble', description: 'Elegant marble patterns and gradients', category: 'textured' },
  { id: 'textured-wood', name: 'Textured Wood', description: 'Warm wood grain textures', category: 'textured' },
  { id: 'textured-glass', name: 'Textured Glass', description: 'Frosted glass with light refraction', category: 'textured' },
  { id: 'colorway-ocean', name: 'Ocean Colorway', description: 'Cool ocean blues and teals', category: 'colorway' },
  { id: 'colorway-forest', name: 'Forest Colorway', description: 'Natural greens and earth tones', category: 'colorway' },
  { id: 'toybox', name: 'Toybox', description: 'Playful vibrant colors with visualizer', category: 'themed' },
];

// More Models Modal Component
function MoreModelsModal({ isOpen, onClose, currentModelId, setModelId, unavailableModels = new Set() }: any) {
  if (!isOpen) return null;

  const categories = ['Standard', 'Advanced'];
  const modelsByCategory = categories.map(cat => ({
    category: cat,
    models: MORE_MODELS.filter(m => m.category === cat && !unavailableModels.has(m.id))
  }));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-light tracking-wide flex items-center gap-2">
            <Zap className="w-6 h-6 text-[var(--accent)]" />
            More Models
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          {modelsByCategory.map(({ category, models }) => (
            <motion.section
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {models.map((model, idx) => (
                  <motion.button
                    key={model.id}
                    onClick={() => { setModelId(model.id); onClose(); }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03, ease: 'easeOut' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-xl border transition-all duration-300 text-left ${currentModelId === model.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
                      }`}
                  >
                    <div className="font-medium text-[var(--foreground)] mb-1 flex items-center gap-2">
                      {model.name}
                      {model.category === 'Advanced' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">PRO</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{model.description}</div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// Looks Modal Component
function LooksModal({ isOpen, onClose, currentLook, setLook }: any) {
  if (!isOpen) return null;

  const categories = ['essential', 'modern', 'dark', 'light', 'themed', 'textured', 'colorway'];
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

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
          {looksByCategory.map(({ category, looks }) => (
            <motion.section
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {looks.map((look, idx) => (
                  <motion.button
                    key={look.id}
                    onClick={() => { setLook(look.id); onClose(); }}
                    data-look-preview={look.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03, ease: 'easeOut' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`look-preview-button p-4 rounded-xl border transition-all duration-300 text-left relative overflow-hidden ${currentLook === look.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface)]'
                      }`}
                  >
                    <div className="font-medium text-[var(--foreground)] mb-1 relative z-10 transition-transform duration-300">{look.name}</div>
                    <div className="text-xs text-[var(--muted)] relative z-10">{look.description}</div>
                    <div className="look-preview-animation absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 ease-out pointer-events-none"></div>
                  </motion.button>
                ))}
              </div>
            </motion.section>
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
  onOpenMoreModels,
  neuralNoiseEnabled,
  setNeuralNoiseEnabled,
  availableModels = [] as typeof MODELS
}: any) {
  if (!isOpen) return null;

  const handleReset = () => {
    setLayout('standard');
    setFontSize('normal');
    setDataSaver(false);
    setFocusMode(false);
    setSystemPrompt('');
    setModelId('ooverta');
    setNeuralNoiseEnabled(true);
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

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>

          {/* Layout Section - Structure Only */}
          <section>
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">Layout</h3>
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
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono border-b border-[var(--border)] pb-2">Appearance & Style</h3>
            <div className="grid gap-8">
              <div>
                <h4 className="text-xs text-[var(--muted)] mb-2 uppercase">Text Size</h4>
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
            </div>
          </section>

          {/* AI Configuration */}
          <section className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] mb-4 font-mono flex items-center gap-2">
              <Zap className="w-4 h-4" /> Intelligence Override
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="system-prompt" className="text-xs text-[var(--muted)] uppercase">Custom System Prompt</label>
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
              <h3 className="text-sm uppercase tracking-wider text-[var(--muted)] font-mono">Default Intelligence</h3>
              <button
                onClick={onOpenMoreModels}
                className="text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors px-3 py-1.5 rounded-lg border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--surface)]"
              >
                More Models
              </button>
            </div>
            <div className="grid gap-2">
              {availableModels.map((model: typeof MODELS[0]) => (
                <button
                  key={model.id}
                  onClick={() => setModelId(model.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${currentModelId === model.id
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

// Global Feed Expanded Component
function GlobalFeedExpanded({ onClose }: { onClose: () => void }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/news')
      .then(res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Failed to fetch news');
        }
        return res.json();
      })
      .then(data => {
        setNews(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((error) => {
        console.warn('News fetch error (non-critical):', error);
        setNews([]);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full mb-8 bg-[var(--hud-bg)] border border-[var(--border)] rounded-2xl overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-light tracking-wide flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--accent)]" />
            Global Feed
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar max-h-[60vh]">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-full bg-[var(--surface-strong)] rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-[var(--surface-strong)] rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[var(--surface-strong)] rounded animate-pulse" />
            </div>
          ) : news.length > 0 ? (
            <div className="space-y-4">
              {news.map((story: any) => (
                <a
                  key={story.id}
                  href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group"
                >
                  <h3 className="text-sm font-medium text-[var(--foreground)] mb-2 group-hover:text-[var(--accent)] transition-colors">
                    {story.title}
                  </h3>
                  {story.by && (
                    <p className="text-xs text-[var(--muted)]">
                      by {story.by} {story.score && `• ${story.score} points`}
                    </p>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[var(--muted)]">No news available at the moment.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Widgets Component
function Widgets() {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/news')
      .then(res => {
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          return [];
        }
        return res.json();
      })
      .then(data => setNews(Array.isArray(data) ? data : []))
      .catch(() => { });
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

// Real-time Stats Component - Shows only number of users (Initialize Chat clicks)
function LiveStats() {
  const [userCount, setUserCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Stats API not available');
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
          return;
        }
        const data = await response.json();
        setUserCount(data.users || data.totalUsers || 0);
      } catch (error) {
        // Silently handle stats errors
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-6 right-6 z-50">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-4 bg-[var(--hud-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-4 shadow-2xl min-w-[200px]"
          >
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--muted)]">Users</span>
              <span className="text-[var(--accent)] font-mono font-bold">
                {userCount.toLocaleString()}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-[var(--chip-bg)] backdrop-blur-xl border border-[var(--border)] rounded-full px-3 py-1.5 shadow-lg hover:bg-[var(--surface-strong)] transition-colors"
      >
        <Users className="w-3 h-3 text-[var(--accent)]" />
        <span className="text-xs text-[var(--muted-strong)] font-mono">
          {userCount.toLocaleString()}
        </span>
      </motion.button>
    </div>
  );
}

// Interactive Particle/Constellation Background Component
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle system - Optimized for smoothness
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
      targetOpacity: number;
    }> = [];

    const particleCount = 120;
    const connectionDistance = 120;
    let lastTime = performance.now();

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.3,
        targetOpacity: Math.random() * 0.4 + 0.3,
      });
    }

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 16, 2); // Cap delta for smoothness
      lastTime = currentTime;

      // Use requestAnimationFrame for smooth rendering
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Smooth mouse interaction
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 120) {
          const force = (120 - distance) / 120;
          particle.vx += (dx * force * 0.0005) * deltaTime;
          particle.vy += (dy * force * 0.0005) * deltaTime;
        }

        // Update position with delta time for consistent speed
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;

        // Smooth velocity damping
        particle.vx *= 0.98;
        particle.vy *= 0.98;

        // Wrap around edges smoothly
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = canvas.height + 10;
        if (particle.y > canvas.height + 10) particle.y = -10;

        // Smooth opacity transitions
        particle.opacity += (particle.targetOpacity - particle.opacity) * 0.05;

        // Draw particle with smooth rendering
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 2
        );
        gradient.addColorStop(0, `rgba(0, 212, 255, ${particle.opacity})`);
        gradient.addColorStop(1, `rgba(0, 212, 255, 0)`);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw connections with smooth gradients
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = otherParticle.x - particle.x;
          const dy = otherParticle.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = 0.15 * (1 - distance / connectionDistance);
            const gradient = ctx.createLinearGradient(
              particle.x, particle.y,
              otherParticle.x, otherParticle.y
            );
            gradient.addColorStop(0, `rgba(0, 212, 255, ${opacity})`);
            gradient.addColorStop(1, `rgba(0, 212, 255, ${opacity * 0.5})`);

            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
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

// Visualizer Configuration Panel Component - Rewritten to match image
function VisualizerConfigPanel({
  isOpen,
  onClose,
  mode,
  onModeChange,
  speed,
  onSpeedChange,
  color1,
  onColor1Change,
  color2,
  onColor2Change,
  density,
  onDensityChange,
  invertX,
  onInvertXChange,
  invertY,
  onInvertYChange,
  scaleX,
  onScaleXChange,
  scaleY,
  onScaleYChange,
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
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: 'grid' | 'plane' | 'wave_form' | 'manhattan';
  onModeChange: (mode: 'grid' | 'plane' | 'wave_form' | 'manhattan') => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  color1: string;
  onColor1Change: (color: string) => void;
  color2: string;
  onColor2Change: (color: string) => void;
  density: number;
  onDensityChange: (density: number) => void;
  invertX: boolean;
  onInvertXChange: (invert: boolean) => void;
  invertY: boolean;
  onInvertYChange: (invert: boolean) => void;
  scaleX: boolean;
  onScaleXChange: (scale: boolean) => void;
  scaleY: boolean;
  onScaleYChange: (scale: boolean) => void;
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
}) {
  if (!isOpen) return null;

  const palettes = [
    ['#4a90e2', '#7b68ee'], ['#ff6b35', '#00d4ff'], ['#ff4757', '#5352ed'],
    ['#2ed573', '#1e90ff'], ['#ffa502', '#ff6348'], ['#5f27cd', '#00d2d3'],
    ['#ee5a6f', '#c44569'], ['#00d2ff', '#3a7bd5'], ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'],
    ['#30cfd0', '#330867'], ['#a8edea', '#fed6e3'], ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
  ];

  const modeOptions = [
    { value: 'wave_form', label: 'WAVE_FORM', icon: Waves },
    { value: 'grid', label: 'GRID', icon: Square },
    { value: 'plane', label: 'PLANE', icon: Square },
    { value: 'manhattan', label: 'MANHATTAN', icon: MapPin },
  ];

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-[var(--hud-bg)]/98 backdrop-blur-xl border-l border-[var(--border)] shadow-2xl overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-[var(--foreground)]">Visualizer Config</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--surface)] rounded transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block font-medium">MODE</label>
          <div className="relative">
            <select
              value={mode}
              onChange={(e) => onModeChange(e.target.value as any)}
              className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] appearance-none cursor-pointer hover:border-[var(--accent)] transition-colors pr-10"
            >
              {modeOptions.map((opt) => (
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
            {palettes.map((palette, idx) => (
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

// R3F Visualizer Component - Dynamically loaded
function R3FVisualizer({
  mode = 'wave_form',
  speed = 0.3,
  color1 = '#ff6b35',
  color2 = '#00d4ff',
  density = 0.5,
  invertX = false,
  invertY = false,
  scaleX = true,
  scaleY = true,
  maxAmplitude = 1.36,
  waveFreq = 2.0,
  waveFormDouble = false,
  autoOrbit = false,
}: {
  mode?: 'grid' | 'plane' | 'wave_form' | 'manhattan';
  speed?: number;
  color1?: string;
  color2?: string;
  density?: number;
  invertX?: boolean;
  invertY?: boolean;
  scaleX?: boolean;
  scaleY?: boolean;
  maxAmplitude?: number;
  waveFreq?: number;
  waveFormDouble?: boolean;
  autoOrbit?: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [VisualizerCanvas, setVisualizerCanvas] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    setIsMounted(true);

    if (typeof window !== 'undefined') {
      Promise.all([
        import('@react-three/fiber'),
        import('three'),
        import('@react-three/drei')
      ]).then(([r3f, THREE, drei]) => {
        const { Canvas, useThree } = r3f;
        const { BufferAttribute, AdditiveBlending } = THREE;
        const { OrbitControls, useGLTF } = drei;

        const Scene = () => {
          const { camera } = useThree();
          const [audioIntensity, setAudioIntensity] = useState(0);
          const timeRef = useRef(0);

          useEffect(() => {
            const handleMouseMove = (e: MouseEvent) => {
              const intensity = Math.min(1, Math.sqrt(e.movementX ** 2 + e.movementY ** 2) / 50);
              setAudioIntensity(intensity);
            };
            window.addEventListener('mousemove', handleMouseMove);
            return () => window.removeEventListener('mousemove', handleMouseMove);
          }, []);

          useEffect(() => {
            if (camera) {
              if (mode === 'plane') {
                camera.position.set(0, 8, 8);
                camera.lookAt(0, 0, 0);
              } else if (mode === 'grid') {
                camera.position.set(0, 5, 8);
                camera.lookAt(0, 0, 0);
              } else if (mode === 'wave_form') {
                camera.position.set(0, 3, 10);
                camera.lookAt(0, 0, 0);
              } else if (mode === 'manhattan') {
                // Fly-over view for Manhattan
                camera.position.set(0, 8, 12);
                camera.lookAt(0, 0, 0);
                // Animate to 60 degree pitch
                camera.rotation.x = -Math.PI / 3; // 60 degrees
              }
            }
          }, [mode, camera]);

          r3f.useFrame((state, delta) => {
            timeRef.current += delta * speed * 2;
          });

          const renderVisualizer = () => {
            const particleCount = Math.floor(2000 * (0.5 + density));
            const pointsRef = useRef<any>(null);
            const [initialized, setInitialized] = useState(false);
            const originalPositionsRef = useRef<Float32Array | null>(null);

            const hexToRgb = (hex: string) => {
              const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
              } : { r: 255, g: 255, b: 255 };
            };

            useEffect(() => {
              if (!pointsRef.current) return;
              setInitialized(false);
              const positions = new Float32Array(particleCount * 3);
              const colors = new Float32Array(particleCount * 3);

              for (let i = 0; i < particleCount; i++) {
                let x, y, z;
                if (mode === 'wave_form') {
                  const theta = Math.acos(1 - 2 * i / particleCount);
                  const phi = Math.PI * (1 + Math.sqrt(5)) * i;
                  const radius = 5;
                  x = radius * Math.cos(phi) * Math.sin(theta);
                  y = radius * Math.sin(phi) * Math.sin(theta);
                  z = radius * Math.cos(theta);
                } else if (mode === 'grid') {
                  const gridSize = Math.ceil(Math.sqrt(particleCount));
                  const gridX = i % gridSize;
                  const gridZ = Math.floor(i / gridSize);
                  const spacing = 0.3;
                  x = (gridX - gridSize / 2) * spacing;
                  y = 0;
                  z = (gridZ - gridSize / 2) * spacing;
                } else {
                  const gridSize = Math.ceil(Math.sqrt(particleCount));
                  const gridX = i % gridSize;
                  const gridZ = Math.floor(i / gridSize);
                  const spacing = 0.2;
                  x = (gridX - gridSize / 2) * spacing;
                  y = 0;
                  z = (gridZ - gridSize / 2) * spacing;
                }
                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;
                colors[i * 3] = 1;
                colors[i * 3 + 1] = 1;
                colors[i * 3 + 2] = 1;
              }

              // Store original positions for wave_form mode
              if (mode === 'wave_form') {
                originalPositionsRef.current = new Float32Array(positions);
              } else {
                originalPositionsRef.current = null;
              }

              const geometry = pointsRef.current.geometry;
              geometry.setAttribute('position', new BufferAttribute(positions, 3));
              geometry.setAttribute('color', new BufferAttribute(colors, 3));
              setInitialized(true);
            }, [particleCount, mode]);

            r3f.useFrame(() => {
              if (!pointsRef.current || !initialized) return;
              const geometry = pointsRef.current.geometry;
              const positions = geometry.attributes.position;
              const colors = geometry.attributes.color;

              for (let i = 0; i < particleCount; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                let newY = y;
                let distance = 0;

                if (mode === 'wave_form') {
                  // For wave_form, use original positions as base
                  let baseX: number;
                  let baseY: number;
                  let baseZ: number;

                  if (originalPositionsRef.current) {
                    baseX = originalPositionsRef.current[i * 3];
                    baseY = originalPositionsRef.current[i * 3 + 1];
                    baseZ = originalPositionsRef.current[i * 3 + 2];
                  } else {
                    baseX = x;
                    baseY = y;
                    baseZ = z;
                  }

                  distance = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ);
                  const wave1 = Math.sin(timeRef.current * speed * waveFreq + distance * 0.5);
                  const wave2 = mode === 'wave_form' && waveFormDouble
                    ? Math.cos(timeRef.current * speed * waveFreq * 1.5 + distance * 0.3)
                    : Math.cos(timeRef.current * speed * 1.5 + distance * 0.3);
                  const wave = mode === 'wave_form' && waveFormDouble
                    ? (wave1 * 0.5 + wave2 * 0.5) * 0.5 + 0.5
                    : (wave1 * 0.6 + wave2 * 0.4) * 0.5 + 0.5;
                  const amplitude = mode === 'wave_form' ? maxAmplitude : 1.0;

                  // For wave_form, create radial expansion wave effect using original positions
                  if (mode === 'wave_form' && originalPositionsRef.current) {
                    const baseRadius = distance; // Already calculated from original positions
                    const radialOffset = (wave - 0.5) * amplitude * 0.5; // Oscillate around base radius
                    const newRadius = baseRadius + radialOffset;
                    if (baseRadius > 0) {
                      const scale = newRadius / baseRadius;
                      // Always scale from original positions to prevent cumulative shrinking
                      positions.setX(i, baseX * scale);
                      positions.setY(i, baseY * scale);
                      positions.setZ(i, baseZ * scale);
                    }
                    // Update distance for color calculation
                    distance = newRadius;
                  } else {
                    newY = baseY + wave * amplitude * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
                  }
                } else if (mode === 'grid') {
                  // Grid mode - particles arranged in a grid, animated vertically
                  distance = Math.sqrt(x * x + z * z);
                  const wave1 = Math.sin(timeRef.current * speed * 2 + distance * 0.5);
                  const wave2 = Math.sin(timeRef.current * speed * 1.3 + distance * 0.8);
                  const wave = (wave1 * 0.7 + wave2 * 0.3) * 0.5 + 0.5;
                  newY = wave * 2.5 * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
                } else if (mode === 'plane') {
                  // Plane mode - particles on a plane, animated with multiple waves
                  distance = Math.sqrt(x * x + z * z);
                  const wave1 = Math.sin(timeRef.current * speed * 2 + distance * 0.5);
                  const wave2 = Math.sin(timeRef.current * speed * 1.5 + x * 2);
                  const wave3 = Math.sin(timeRef.current * speed * 1.8 + z * 2);
                  const wave = (wave1 * 0.5 + wave2 * 0.25 + wave3 * 0.25) * 0.5 + 0.5;
                  newY = wave * 2 * (scaleY ? 1 : 0) * (invertY ? -1 : 1);
                }

                if (mode !== 'wave_form') {
                  positions.setY(i, newY);
                }

                // Get current position for color calculation
                const currentX = positions.getX(i);
                const currentZ = positions.getZ(i);

                const waveIntensity = Math.sin(timeRef.current * speed * 2 + distance * 0.5) * 0.5 + 0.5;
                const color1RGB = hexToRgb(color1);
                const color2RGB = hexToRgb(color2);
                const mix = waveIntensity;
                const posVariation = (Math.sin(currentX * 0.5) + Math.cos(currentZ * 0.5)) * 0.1;
                const finalMix = Math.max(0, Math.min(1, mix + posVariation));
                colors.setX(i, (color1RGB.r + (color2RGB.r - color1RGB.r) * finalMix) / 255);
                colors.setY(i, (color1RGB.g + (color2RGB.g - color1RGB.g) * finalMix) / 255);
                colors.setZ(i, (color1RGB.b + (color2RGB.b - color1RGB.b) * finalMix) / 255);
              }
              positions.needsUpdate = true;
              colors.needsUpdate = true;
            });

            if (mode === 'manhattan') {
              return null; // Don't render particles for manhattan mode
            }

            return (
              <points ref={pointsRef} rotation={mode === 'plane' ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
                <bufferGeometry />
                <pointsMaterial
                  size={mode === 'wave_form' ? 0.2 : 0.15}
                  vertexColors
                  transparent
                  opacity={0.95}
                  sizeAttenuation={true}
                  blending={AdditiveBlending}
                />
              </points>
            );
          };

          // Enhanced procedural Manhattan with more detail
          const renderManhattan = () => {
            const buildings: React.ReactElement[] = [];
            const gridSize = 40; // Larger grid for more detail
            const spacing = 0.3;

            // Create a more detailed and realistic Manhattan
            for (let x = 0; x < gridSize; x++) {
              for (let z = 0; z < gridSize; z++) {
                const centerX = gridSize / 2;
                const centerZ = gridSize / 2;
                const distFromCenter = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
                const maxDist = Math.sqrt(centerX ** 2 + centerZ ** 2);

                // More realistic height distribution - taller in center, with some randomness
                const heightVariation = 1 - (distFromCenter / maxDist) * 0.5;
                const randomFactor = 0.3 + Math.random() * 0.7;
                const height = 0.4 + heightVariation * randomFactor * 5;

                // Skip very short buildings to create more realistic cityscape
                if (height < 0.6) continue;

                const posX = (x - gridSize / 2) * spacing;
                const posZ = (z - gridSize / 2) * spacing;

                // More realistic gray colors with variation
                const grayBase = 0.3 + Math.random() * 0.3;
                const color = `rgb(${Math.floor(grayBase * 255)}, ${Math.floor(grayBase * 255)}, ${Math.floor(grayBase * 255)})`;

                // Building width/depth variation for more realism
                const width = spacing * (0.6 + Math.random() * 0.4);
                const depth = spacing * (0.6 + Math.random() * 0.4);

                buildings.push(
                  <mesh key={`building-${x}-${z}`} position={[posX, height / 2, posZ]}>
                    <boxGeometry args={[width, height, depth]} />
                    <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />
                  </mesh>
                );
              }
            }

            // Add ground plane
            buildings.push(
              <mesh key="ground" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <planeGeometry args={[gridSize * spacing * 1.2, gridSize * spacing * 1.2]} />
                <meshStandardMaterial color="#0f0f0f" />
              </mesh>
            );

            return <group>{buildings}</group>;
          };

          return (
            <>
              <color attach="background" args={mode === 'manhattan' ? ['#0a0a0a'] : ['#010204']} />
              {mode === 'manhattan' ? (
                <>
                  <ambientLight intensity={0.4} />
                  <directionalLight position={[10, 10, 5]} intensity={0.8} />
                  <directionalLight position={[-10, 5, -5]} intensity={0.3} />
                  <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={5}
                    maxDistance={30}
                    autoRotate={autoOrbit}
                    rotateSpeed={0.5}
                    zoomSpeed={0.8}
                  />
                  {renderManhattan()}
                </>
              ) : (
                <>
                  <ambientLight intensity={0.8} />
                  <pointLight position={[10, 10, 10]} intensity={1} color={color1} />
                  <pointLight position={[-10, -10, -10]} intensity={1} color={color2} />
                  <pointLight position={[0, 10, 0]} intensity={0.5} />
                  <OrbitControls
                    enablePan={false}
                    enableZoom={true}
                    enableRotate={true}
                    minDistance={5}
                    maxDistance={20}
                    autoRotate={autoOrbit}
                    rotateSpeed={0.5}
                    zoomSpeed={0.8}
                  />
                  {renderVisualizer()}
                </>
              )}
            </>
          );
        };

        const Visualizer = () => (
          <Canvas
            key={mode}
            camera={{
              fov: 50,
              near: 0.1,
              far: 1000,
              position: mode === 'plane' ? [0, 8, 8] : mode === 'grid' ? [0, 5, 8] : mode === 'wave_form' ? [0, 3, 10] : mode === 'manhattan' ? [0, 8, 12] : [0, 8, 8],
            }}
            gl={{ antialias: true, alpha: true }}
            className="w-full h-full"
          >
            <Scene />
          </Canvas>
        );

        setVisualizerCanvas(() => Visualizer);
      }).catch((err) => {
        console.error('Failed to load R3F:', err);
      });
    }
  }, [mode, speed, color1, color2, density, invertX, invertY, scaleX, scaleY, maxAmplitude, waveFreq, waveFormDouble, autoOrbit]);

  if (!isMounted || !VisualizerCanvas) {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none bg-[#010204] flex items-center justify-center">
        <div className="text-[var(--accent)] text-sm">Loading visualizer...</div>
      </div>
    );
  }

  const Canvas = VisualizerCanvas;
  return (
    <div className="fixed inset-0 z-40 pointer-events-auto">
      <Canvas />
    </div>
  );
}

export default function Page() {
  const { isMobile, isTablet, isMobileOrTablet } = useMobile();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: string; model: string; image?: string }>>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hideOpenRouterModels, setHideOpenRouterModels] = useState(false);

  // Check OpenRouter rate limit on mount and periodically
  useEffect(() => {
    const checkRateLimit = async () => {
      try {
        const res = await fetch('/api/openrouter');
        if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
          return; // Skip if not JSON response
        }
        const data = await res.json();
        setHideOpenRouterModels(data.shouldHide || false);
      } catch (error) {
        // Silently handle errors - non-critical
      }
    };
    
    checkRateLimit();
    const interval = setInterval(checkRateLimit, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Get available models (combine MODELS and OPENROUTER_MODELS, filter by rate limit)
  const availableModels = [
    ...MODELS,
    ...(hideOpenRouterModels ? [] : OPENROUTER_MODELS),
  ];

  const [selectedModelId, setSelectedModelId] = useState(availableModels[0]?.id || MODELS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLooksOpen, setIsLooksOpen] = useState(false);
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false);
  const [isGlobalFeedOpen, setIsGlobalFeedOpen] = useState(false);
  const [look, setLook] = useState('midnight');
  const [layout, setLayout] = useState('standard');
  const [fontSize, setFontSize] = useState('normal');
  const [dataSaver, setDataSaver] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closedWidgets, setClosedWidgets] = useState<Set<string>>(new Set());
  // Visualizer state
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  const [visualizerConfigOpen, setVisualizerConfigOpen] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'grid' | 'plane' | 'wave_form' | 'manhattan'>('wave_form');
  const [visualizerSpeed, setVisualizerSpeed] = useState(0.3);
  const [visualizerColor1, setVisualizerColor1] = useState('#ff6b35');
  const [visualizerColor2, setVisualizerColor2] = useState('#00d4ff');
  const [visualizerDensity, setVisualizerDensity] = useState(0.5);
  const [visualizerInvertX, setVisualizerInvertX] = useState(false);
  const [visualizerInvertY, setVisualizerInvertY] = useState(false);
  const [visualizerScaleX, setVisualizerScaleX] = useState(true);
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

  const [neuralNoiseEnabled, setNeuralNoiseEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roovert_neural_noise_enabled');
      return saved !== 'false'; // Default to true
    }
    return true;
  });
  // Track unavailable models (models that have failed recently)
  const [unavailableModels, setUnavailableModels] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const responseEndRef = useRef<HTMLDivElement>(null);

  // Model availability checking removed - endpoint deleted
  useEffect(() => {
    const checkModelAvailability = async () => {
      // Model availability endpoint removed
      // Availability is now handled client-side based on errors
    };

    // Check immediately on mount
    checkModelAvailability();

    // Then check every 5 minutes
    const interval = setInterval(checkModelAvailability, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
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

  // Check consent and initialize Segment if already accepted
  useEffect(() => {
    // checkConsentAndInitialize(); // Removed - function doesn't exist
  }, []);

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
    
    // Disable visualizer when switching out of toybox theme
    if (look !== 'toybox' && visualizerEnabled) {
      setVisualizerEnabled(false);
    }
  }, [look, layout, fontSize, dataSaver, visualizerEnabled]);


  // Filter out unavailable models (use the combined list from above)
  const filteredAvailableModels = availableModels.filter(m => !unavailableModels.has(m.id));
  const selectedModel = filteredAvailableModels.find(m => m.id === selectedModelId) || filteredAvailableModels[0];

  // If selected model becomes unavailable, switch to first available
  useEffect(() => {
    if (selectedModelId && unavailableModels.has(selectedModelId)) {
      if (filteredAvailableModels.length > 0) {
        setSelectedModelId(filteredAvailableModels[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleInitialize = async () => {
    // Track "Initialize Chat" click
    try {
      await fetch('/api/track-initialize', { method: 'POST' });
    } catch (error) {
      // Silently fail - tracking is not critical
    }
    
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

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsProcessing(false);
    }
  };

  const copyCodeBlock = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeBlock(code);
      setTimeout(() => setCopiedCodeBlock(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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

  // Image upload handler
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prevent upload if disabled (model unavailable or API key missing)
    if (isImageUploadDisabled) {
      event.target.value = ''; // Clear the input
      setStatusNote(`Image upload is disabled: ${imageUploadDisabledReason}. Please select an available model.`);
      setTimeout(() => setStatusNote(null), 5000);
      return;
    }

    // Security: Validate file extension (MIME type can be spoofed)
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please select a JPG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file type (MIME type check)
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 20MB before compression)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      alert('Image size must be less than 20MB. Large images will be automatically compressed.');
      return;
    }

    setImageFile(file);

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
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || isProcessing) {
      return;
    }

    setIsChatMode(true);
    setIsProcessing(true);
    setResponse('');
    setStatusNote(null);

    // Create abort controller for streaming
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Build conversation history in the format expected by the API
      // Preserve image data in history
      const conversationHistory = history.map(h => {
        const userMsg: any = { role: 'user' as const };

        // If history entry has an image, use vision format
        if (h.image) {
          userMsg.content = [
            { type: 'text', text: h.query },
            { type: 'image_url', image_url: { url: h.image } }
          ];
        } else {
          userMsg.content = h.query;
        }

        return [
          userMsg,
          { role: 'assistant' as const, content: h.response }
        ];
      }).flat();

      // Build current message with image if present
      let currentMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      if (selectedImage) {
        currentMessageContent = [
          { type: 'text', text: trimmedQuery },
          { type: 'image_url', image_url: { url: selectedImage } }
        ];
      } else {
        currentMessageContent = trimmedQuery;
      }

      // Determine if this is an OpenRouter model
      const isOpenRouterModel = OPENROUTER_MODELS.some(m => m.id === selectedModel.id);
      const apiEndpoint = isOpenRouterModel ? '/api/openrouter' : '/api/query-gateway';
      
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: trimmedQuery,
          image: selectedImage || undefined,
          model: selectedModel.id, // Send model ID, not API ID (backend maps it)
          systemPrompt: systemPrompt || undefined,
          conversationHistory: conversationHistory
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
            if (data.content) {
              fullResponse += data.content;
              setResponse(fullResponse);

              // Check if response indicates model error (provider error, rate limit, etc.)
              if (typeof data.content === 'string' && (
                data.content.includes('Provider Error') ||
                data.content.includes('rate limit') ||
                data.content.includes('quota') ||
                data.content.includes('limit exceeded') ||
                data.content.includes('Systems Notice') ||
                data.content.includes('Provider returned error')
              )) {
                // Mark model as unavailable temporarily (for 5 minutes)
                setUnavailableModels(prev => new Set(prev).add(selectedModelId));
                setTimeout(() => {
                  setUnavailableModels(prev => {
                    const next = new Set(prev);
                    next.delete(selectedModelId);
                    return next;
                  });
                }, 5 * 60 * 1000); // 5 minutes
              }

              // Auto-scroll to bottom
              setTimeout(() => {
                responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
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
                  image: selectedImage || undefined
                },
              ]);
              setResponse(null); // Clear current response after adding to history
              setQuery('');
              setSelectedImage(null); // Clear image after sending
              setImageFile(null);
              setEditingIndex(null); // Clear editing state
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              // Auto-scroll to bottom after adding to history
              setTimeout(() => {
                responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
              return;
            }

            // Check if response indicates model error
            if (data.content && typeof data.content === 'string' && (
              data.content.includes('Provider Error') ||
              data.content.includes('rate limit') ||
              data.content.includes('quota') ||
              data.content.includes('limit exceeded') ||
              data.content.includes('Systems Notice')
            )) {
              // Mark model as unavailable temporarily
              setUnavailableModels(prev => new Set(prev).add(selectedModelId));
              setTimeout(() => {
                setUnavailableModels(prev => {
                  const next = new Set(prev);
                  next.delete(selectedModelId);
                  return next;
                });
              }, 5 * 60 * 1000); // 5 minutes
            }
          } catch (e) {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (error: any) {
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isProcessing && query.trim()) {
          handleSubmit(e as any);
        }
      }
      // Escape to stop
      if (e.key === 'Escape' && isProcessing) {
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query, isProcessing]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500 flex flex-col">
      {/* Neural Noise and Audio Visualizer removed - using R3F visualizer instead */}

      {/* R3F Visualizer */}
      {visualizerEnabled && look === 'toybox' && (
        <R3FVisualizer
          mode={visualizerMode}
          speed={visualizerSpeed}
          color1={visualizerColor1}
          color2={visualizerColor2}
          density={visualizerDensity}
          invertX={visualizerInvertX}
          invertY={visualizerInvertY}
          scaleX={visualizerScaleX}
          scaleY={visualizerScaleY}
          maxAmplitude={maxAmplitude}
          waveFreq={waveFreq}
          waveFormDouble={waveFormDouble}
          autoOrbit={autoOrbit}
        />
      )}

      {/* Visualizer Configuration Panel */}
      <VisualizerConfigPanel
        isOpen={visualizerConfigOpen}
        onClose={() => setVisualizerConfigOpen(false)}
        mode={visualizerMode}
        onModeChange={setVisualizerMode}
        speed={visualizerSpeed}
        onSpeedChange={setVisualizerSpeed}
        color1={visualizerColor1}
        onColor1Change={setVisualizerColor1}
        color2={visualizerColor2}
        onColor2Change={setVisualizerColor2}
        density={visualizerDensity}
        onDensityChange={setVisualizerDensity}
        invertX={visualizerInvertX}
        onInvertXChange={setVisualizerInvertX}
        invertY={visualizerInvertY}
        onInvertYChange={setVisualizerInvertY}
        scaleX={visualizerScaleX}
        onScaleXChange={setVisualizerScaleX}
        scaleY={visualizerScaleY}
        onScaleYChange={setVisualizerScaleY}
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
          setVisualizerMode('wave_form');
          setVisualizerSpeed(0.3);
          setVisualizerColor1('#ff6b35');
          setVisualizerColor2('#00d4ff');
          setVisualizerDensity(0.5);
          setVisualizerInvertX(false);
          setVisualizerInvertY(false);
          setVisualizerScaleX(true);
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
                className={`text-2xl font-bold hover:opacity-80 transition-opacity drop-shadow-[0_0_8px_rgba(var(--accent-rgb,0,128,128),0.5)] ${look === 'toybox'
                  ? 'text-black drop-shadow-none'
                  : 'bg-gradient-to-r from-[var(--foreground)] to-[var(--accent)] bg-clip-text text-transparent'
                  }`}
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

            {/* Theme Selector - Center */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              <button
                onClick={() => setIsLooksOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] hover:border-[var(--accent)] transition-all text-[var(--muted)] hover:text-[var(--accent)] group"
                title="Change Theme"
              >
                <Paintbrush className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              </button>
              {look === 'toybox' && (
                <>
                  <button
                    onClick={() => {
                      setVisualizerEnabled(!visualizerEnabled);
                      if (!visualizerEnabled) {
                        setVisualizerConfigOpen(true);
                      }
                    }}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all group ${visualizerEnabled
                      ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-strong)] border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--accent)]'
                      }`}
                    title="Toggle Visualizer"
                  >
                    <Sparkles className={`w-5 h-5 ${visualizerEnabled ? 'animate-pulse' : ''}`} />
                  </button>
                  {visualizerEnabled && (
                    <button
                      onClick={() => setVisualizerConfigOpen(!visualizerConfigOpen)}
                      className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all group ${visualizerConfigOpen
                        ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-strong)] border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--accent)]'
                        }`}
                      title="Visualizer Settings"
                    >
                      <Square className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="hidden md:flex items-center gap-8">
              <button
                onClick={() => setIsGlobalFeedOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--surface)] transition-colors text-[var(--foreground)]/70 hover:text-[var(--accent)]"
                title="Global Feed"
              >
                <Globe className="w-5 h-5" />
              </button>
              <a
                href="#mission"
                className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
              >
                Mission
              </a>
              <Link
                href="/careers"
                className="text-sm text-[var(--foreground)]/70 hover:text-[var(--accent)] transition-colors uppercase tracking-wider"
              >
                Careers
              </Link>
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
            onOpenMoreModels={() => setIsMoreModelsOpen(true)}
            neuralNoiseEnabled={neuralNoiseEnabled}
            setNeuralNoiseEnabled={setNeuralNoiseEnabled}
            availableModels={availableModels}
          />
        )}
      </AnimatePresence>

      {/* More Models Modal */}
      <AnimatePresence>
        {isMoreModelsOpen && (
          <MoreModelsModal
            isOpen={isMoreModelsOpen}
            onClose={() => setIsMoreModelsOpen(false)}
            currentModelId={selectedModelId}
            setModelId={setSelectedModelId}
            unavailableModels={unavailableModels}
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

      {!focusMode && !isChatMode && <LiveStats />}

      {/* Interactive Particle Background for Deep Space Look */}
      {look === 'space' && <ParticleBackground />}

      {/* Main Content Area */}
      <main id="main-content" className="theme-shell relative z-10 flex-1 flex flex-col px-6 pt-32 pb-20 overflow-hidden">

        {/* Global Feed - Expandable Section */}
        <AnimatePresence>
          {isGlobalFeedOpen && (
            <GlobalFeedExpanded onClose={() => setIsGlobalFeedOpen(false)} />
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

              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} md:grid-cols-4 gap-4 w-full max-w-2xl`}>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => injectPrompt(prompt)}
                    className="p-4 text-xs text-left border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all text-white hover:text-[var(--foreground)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Section (Shown when NOT in Chat Mode) */}
        {!isChatMode && (
          <div className="w-full max-w-7xl mx-auto mt-20 space-y-16 pb-20">

            {/* Browse AI Models */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="text-2xl font-light">Browse AI Models</h2>
                </div>
                <button
                  onClick={() => setIsMoreModelsOpen(true)}
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  View All Models <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredAvailableModels.slice(0, 8).map((model, idx) => (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => {
                      setSelectedModelId(model.id);
                      handleInitialize();
                    }}
                    className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/40 hover:bg-[var(--surface)] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-[var(--accent)]" />
                      <h3 className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                        {model.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--muted)] line-clamp-2">{model.description}</p>
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <span className="text-xs text-[var(--muted)] font-mono">{model.category}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>


            {/* Code Examples */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="text-2xl font-light">Code Examples</h2>
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
                    className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-xl p-5"
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

                  <div className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? 'pr-2' : 'pr-4'} min-h-[40vh]`}>
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
                              {/* User Message */}
                              <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-xl"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/20 flex-shrink-0">
                                    <Zap className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider font-bold mb-2">
                                      You
                                    </div>
                                    {entry.image && (
                                      <div className="mb-3 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-strong)]">
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

                              {/* AI Response */}
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6 shadow-xl"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="text-xs text-[var(--accent)] font-mono uppercase tracking-wider font-bold">
                                        {filteredAvailableModels.find(m => m.id === entry.model)?.name || availableModels.find(m => m.id === entry.model)?.name || 'AI'}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setQuery(entry.query);
                                            setSelectedImage(entry.image || null);
                                            setEditingIndex(idx);
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
                                              const conversationHistory = history.slice(0, idx).map(h => {
                                                const userMsg: any = { role: 'user' as const };
                                                if (h.image) {
                                                  userMsg.content = [
                                                    { type: 'text', text: h.query },
                                                    { type: 'image_url', image_url: { url: h.image } }
                                                  ];
                                                } else {
                                                  userMsg.content = h.query;
                                                }
                                                return [
                                                  userMsg,
                                                  { role: 'assistant' as const, content: h.response }
                                                ];
                                              }).flat();

                                              let currentMessageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
                                              if (entry.image) {
                                                currentMessageContent = [
                                                  { type: 'text', text: entry.query },
                                                  { type: 'image_url', image_url: { url: entry.image } }
                                                ];
                                              } else {
                                                currentMessageContent = entry.query;
                                              }

                                              const res = await fetch('/api/query-gateway', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  query: entry.query,
                                                  image: entry.image || undefined,
                                                  model: selectedModelId,
                                                  systemPrompt: systemPrompt || undefined,
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
                                                        newHistory[idx] = { ...newHistory[idx], response: fullResponse };
                                                        return newHistory;
                                                      });
                                                      setResponse(null);
                                                      return;
                                                    }
                                                  } catch (e) { }
                                                }
                                              }
                                            } catch (error: any) {
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
                                      </div>
                                    </div>
                                    <div className="text-[var(--foreground)] text-lg leading-relaxed font-light markdown-content">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight]}
                                        // Security: Disable HTML rendering to prevent XSS
                                        disallowedElements={['script', 'iframe', 'object', 'embed']}
                                        unwrapDisallowed={true}
                                        components={{
                                          code: ({ node, inline, className, children, ...props }: any) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const code = String(children).replace(/\n$/, '');
                                            const isCopied = copiedCodeBlock === code;

                                            return !inline ? (
                                              <div className="relative my-4">
                                                <div className="flex items-center justify-between p-2 bg-[var(--surface-strong)] border-b border-[var(--border)] rounded-t-lg">
                                                  <span className="text-xs text-[var(--muted)] font-mono">
                                                    {match ? match[1] : 'code'}
                                                  </span>
                                                  <button
                                                    onClick={() => copyCodeBlock(code)}
                                                    className="flex items-center gap-1.5 px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                                  >
                                                    {isCopied ? (
                                                      <>
                                                        <Check className="w-3 h-3" />
                                                        Copied
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Copy className="w-3 h-3" />
                                                        Copy
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                                <pre className={`${className} m-0 rounded-b-lg rounded-t-none overflow-x-auto`} {...props}>
                                                  <code className={className} {...props}>
                                                    {children}
                                                  </code>
                                                </pre>
                                              </div>
                                            ) : (
                                              <code className={`${className} bg-[var(--surface-strong)] px-1.5 py-0.5 rounded text-sm`} {...props}>
                                                {children}
                                              </code>
                                            );
                                          },
                                        }}
                                      >
                                        {entry.response}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Current Response (if processing or showing latest) */}
                    <AnimatePresence mode="popLayout">
                      {(response || isProcessing) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
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
                                  <div className="flex items-center gap-3">
                                    <div className="flex space-x-1 h-6 items-center">
                                      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce"></div>
                                    </div>
                                    <button
                                      onClick={handleStop}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                    >
                                      <Square className="w-3 h-3" />
                                      Stop
                                    </button>
                                  </div>
                                ) : response ? (
                                  <div className="text-[var(--foreground)] text-lg leading-relaxed font-light markdown-content">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeHighlight]}
                                      // Security: Disable HTML rendering to prevent XSS
                                      disallowedElements={['script', 'iframe', 'object', 'embed']}
                                      unwrapDisallowed={true}
                                      components={{
                                        code: ({ node, inline, className, children, ...props }: any) => {
                                          const match = /language-(\w+)/.exec(className || '');
                                          const code = String(children).replace(/\n$/, '');
                                          const isCopied = copiedCodeBlock === code;

                                          return !inline ? (
                                            <div className="relative my-4">
                                              <div className="flex items-center justify-between p-2 bg-[var(--surface-strong)] border-b border-[var(--border)] rounded-t-lg">
                                                <span className="text-xs text-[var(--muted)] font-mono">
                                                  {match ? match[1] : 'code'}
                                                </span>
                                                <button
                                                  onClick={() => copyCodeBlock(code)}
                                                  className="flex items-center gap-1.5 px-2 py-1 text-xs border border-[var(--border)] rounded hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                                >
                                                  {isCopied ? (
                                                    <>
                                                      <Check className="w-3 h-3" />
                                                      Copied
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy className="w-3 h-3" />
                                                      Copy
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                              <pre className={`${className} m-0 rounded-b-lg rounded-t-none overflow-x-auto`} {...props}>
                                                <code className={className} {...props}>
                                                  {children}
                                                </code>
                                              </pre>
                                            </div>
                                          ) : (
                                            <code className={`${className} bg-[var(--surface-strong)] px-1.5 py-0.5 rounded text-sm`} {...props}>
                                              {children}
                                            </code>
                                          );
                                        },
                                      }}
                                    >
                                      {response}
                                    </ReactMarkdown>
                                    <div ref={responseEndRef} />
                                  </div>
                                ) : null}
                              </div>
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
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Deck - Fixed at bottom for chat mode */}
      {isChatMode && (
        <div className={`fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/95 backdrop-blur-xl border-t border-[var(--border)] ${isMobile ? 'p-3' : 'p-4'}`}>
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

            <form onSubmit={handleSubmit} className="relative">
              <div className={`gemini-rainbow-border glass-panel relative bg-[var(--panel-bg)] backdrop-blur-2xl ${isMobile ? 'p-3' : 'p-4'} shadow-2xl transition-all duration-300`}>
                <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
                  {isProcessing && (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  )}
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
                          {filteredAvailableModels.map(model => (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                setSelectedModelId(model.id);
                                setIsModelMenuOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 text-xs transition-colors hover:bg-[var(--surface-strong)] flex items-center justify-between ${selectedModelId === model.id ? 'text-[var(--accent)] bg-[var(--surface)]' : 'text-[var(--foreground)]'
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

                  {/* Image Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                    disabled={isProcessing || isImageUploadDisabled}
                  />
                  <label
                    htmlFor="image-upload"
                    className={`p-2 rounded-lg transition-colors ${isImageUploadDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-[var(--surface-strong)] cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]'
                      }`}
                    title={isImageUploadDisabled ? `Image upload disabled: ${imageUploadDisabledReason}` : 'Upload image'}
                  >
                    <Paperclip className="w-5 h-5" />
                  </label>

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>

                  <label htmlFor="query-input-bottom" className="sr-only">
                    Ask {selectedModel.name} anything
                  </label>
                  <input
                    ref={inputRef}
                    id="query-input-bottom"
                    name="query"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Ask ${selectedModel.name} anything... `}
                    className="flex-1 bg-transparent border-none outline-none text-[var(--foreground)] text-xl placeholder:text-[var(--foreground)]/30 transition-colors font-light"
                    disabled={isProcessing}
                    aria-label="Query input"
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || isProcessing}
                    className="flex items-center justify-center w-12 h-12 p-0 bg-[var(--accent)] hover:opacity-90 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[var(--accent)]/20"
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
          </div>
        </div>
      )}

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

          {/* Built With Itself Section */}
          <section className="relative z-10 py-32 border-t border-[var(--border)]">
            <div className="max-w-5xl mx-auto px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-12"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Code className="w-6 h-6 text-[var(--accent)]" />
                  <h2 className="text-3xl font-light">Built With Itself</h2>
                </div>
                <div className="space-y-6 text-[var(--foreground)]/80 leading-relaxed">
                  <p className="text-lg">
                    Here's something interesting: large portions of Roovert were built using Roovert itself.
                  </p>
                  <p>
                    The code you're reading, the components rendering on this page, the API routes handling your requests—many of them started as conversations with the AI models powering this interface. We asked questions, refined prompts, iterated on responses, and built features in real-time through the same chat interface you're using now.
                  </p>
                  <p>
                    This isn't a gimmick. It's a practical demonstration of what happens when you treat AI as a first-class development tool rather than a novelty. The privacy policy, the consent banner, the visitor tracking system, the UI components—all of it emerged from iterative conversations where we challenged assumptions, tested implementations, and refined code until it worked.
                  </p>
                  <p>
                    There's something recursive about building an AI interface with AI. You end up with a product that understands its own construction, that can explain its architecture, that knows why certain decisions were made. It creates a kind of self-awareness in the codebase that traditional development doesn't usually achieve.
                  </p>
                  <p className="text-[var(--accent)] font-medium">
                    We're not just building tools for AI. We're building tools with AI, and that changes everything.
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
