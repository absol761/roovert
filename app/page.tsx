'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Send, Sparkles, Zap, Settings, X, Globe, ChevronDown, Maximize, Minimize, Copy, Check, Square, Paperclip, Edit2, RefreshCw, Search, Code, Star, ArrowRight, Paintbrush, Waves } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useMobile } from './hooks/useMobile';
import { useMicLevel } from './hooks/useMicLevel';
import { LooksModal } from './components/modals/LooksModal';
import { MoreModelsModal } from './components/modals/MoreModelsModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { GlobalFeedExpanded } from './components/GlobalFeedExpanded';
import { LiveStats } from './components/nav/LiveStats';
import { NavClock } from './components/nav/NavClock';
import { MODELS, OPENROUTER_MODELS } from './lib/models';
import { QUICK_PROMPTS, SIGNALS } from './lib/constants';

// Both pull in react-three-fiber/three/drei (a large 3D dependency) so they're
// only ever fetched by the browser once the visualizer is actually opened,
// instead of shipping in every visitor's initial bundle.
const R3FVisualizer = dynamic(() => import('./components/visualizer/R3FVisualizer'), { ssr: false });
const VisualizerConfigPanel = dynamic(
  () => import('./components/visualizer/VisualizerConfigPanel').then(m => m.VisualizerConfigPanel),
  { ssr: false }
);

type ChatContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;

export default function Page() {
  const { isMobile } = useMobile();
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; response: string; model: string; image?: string; perspectives?: Array<{ model: string; content: string }> }>>([]);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [isChatMode, setIsChatMode] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [copiedCodeBlock, setCopiedCodeBlock] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
      } catch {
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
  const [isGlobalFeedOpen, setIsGlobalFeedOpen] = useState(false);
  const [look, setLook] = useState('midnight');
  const [layout, setLayout] = useState('standard');
  const [fontSize, setFontSize] = useState('normal');
  const [dataSaver, setDataSaver] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isMoreModelsOpen, setIsMoreModelsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [closedWidgets, setClosedWidgets] = useState<Set<string>>(new Set());
  // Visualizer state - the app ships a full react-three-fiber background
  // visualizer + config panel; it previously had no way to ever be enabled
  // or opened (dead feature) and wasn't actually audio-reactive despite the
  // name (its "audioIntensity" was driven by mouse movement, unused). Now
  // reachable via the nav's Waves button, genuinely reacts to real audio via
  // the mic, and stays off by default since enabling it requests mic access.
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  // Single shared mic stream for both the nav's pulsing indicator and the
  // 3D visualizer's particle motion - only requested while the visualizer
  // is actually on.
  const { level: micLevel, levelRef: micLevelRef } = useMicLevel(visualizerEnabled);
  const [visualizerConfigOpen, setVisualizerConfigOpen] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<'grid' | 'plane' | 'wave_form' | 'manhattan'>('wave_form');
  const [visualizerSpeed, setVisualizerSpeed] = useState(0.3);
  const [visualizerColor1, setVisualizerColor1] = useState('#4a90e2');
  const [visualizerColor2, setVisualizerColor2] = useState('#7b68ee');
  const [visualizerDensity, setVisualizerDensity] = useState(0.5);
  const [visualizerInvertY, setVisualizerInvertY] = useState(false);
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

  // Parallel orchestration and output length
  // No UI control currently sets these - they're pinned at their defaults,
  // so only the getter is meaningful here.
  const [runParallel] = useState(false);
  const [outputLength] = useState<'small' | 'medium' | 'large'>('medium');
  // Multi-Perspective dropdowns must only offer Groq-backed models - the
  // backend's MODEL_MAP (query-gateway/route.ts) only knows how to route
  // those ids; an OpenRouter model here would silently mis-route.
  const groqOnlyModels = MODELS.filter(m => m.id !== 'multi-perspective');
  const [parallelModel1, setParallelModel1] = useState(groqOnlyModels[0]?.id || 'ooverta');
  const [parallelModel2, setParallelModel2] = useState(groqOnlyModels[1]?.id || 'llama-3.3-70b');
  // Live per-model text for an in-flight Multi-Perspective request, keyed by
  // model id (e.g. parallelModel1's value). Null when not in a
  // multi-perspective request.
  const [perspectiveResponses, setPerspectiveResponses] = useState<Record<string, string> | null>(null);
  // Which models (by id) in the current in-flight Multi-Perspective request
  // have individually finished streaming - drives the per-card loader.
  const [perspectiveDoneModels, setPerspectiveDoneModels] = useState<Set<string>>(new Set());

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

  // Auto-scroll to bottom when history or response changes
  useEffect(() => {
    if (isChatMode && (history.length > 0 || response)) {
      setTimeout(() => {
        responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [history.length, response, isChatMode]);

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
  }, [look, layout, fontSize, dataSaver]);


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
    } catch {
      // Silently fail - tracking is not critical
    }

    setIsChatMode(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
    }
  };

  // Listen for fullscreen changes (e.g., user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleExportChat = () => {
    const text = history.map(h => {
      if (h.perspectives && h.perspectives.length > 0) {
        const perspectivesText = h.perspectives
          .map(p => `  [${availableModels.find(m => m.id === p.model)?.name || p.model}]: ${p.content}`)
          .join('\n');
        return `User: ${h.query}\nAI (Multi-Perspective):\n${perspectivesText}\n\n`;
      }
      return `User: ${h.query}\nAI (${h.model}): ${h.response}\n\n`;
    }).join('---\n');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery || isProcessing) {
      return;
    }

    setIsChatMode(true);
    setIsProcessing(true);
    setResponse('');
    setPerspectiveResponses(null);
    setPerspectiveDoneModels(new Set());
    setStatusNote(null);

    // Create abort controller for streaming
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Build conversation history in the format expected by the API
      // Preserve image data in history
      const conversationHistory = history.map(h => {
        const content: ChatContent = h.image
          ? [
            { type: 'text', text: h.query },
            { type: 'image_url', image_url: { url: h.image } },
          ]
          : h.query;

        return [
          { role: 'user' as const, content },
          { role: 'assistant' as const, content: h.response },
        ];
      }).flat();

      // Determine if this is an OpenRouter model
      const isOpenRouterModel = OPENROUTER_MODELS.some(m => m.id === selectedModel.id);
      const apiEndpoint = isOpenRouterModel ? '/api/openrouter' : '/api/query-gateway';

      // Automatically enable parallel mode if Multi-Perspective is selected
      const isMultiPerspective = selectedModel.id === 'multi-perspective';
      const actualRunParallel = isMultiPerspective || runParallel;
      const activeParallelModel1 = parallelModel1 || 'llama-3.3-70b';
      const activeParallelModel2 = parallelModel2 || 'ooverta';

      if (actualRunParallel) {
        // Seed both models' live buffers so the comparison cards render
        // immediately with their loaders, before the first chunk arrives.
        setPerspectiveResponses({
          [activeParallelModel1]: '',
          [activeParallelModel2]: '',
        });
      }

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
          conversationHistory: conversationHistory,
          runParallel: actualRunParallel,
          outputLength: outputLength,
          parallelModel1: actualRunParallel ? activeParallelModel1 : undefined,
          parallelModel2: actualRunParallel ? activeParallelModel2 : undefined,
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
      // Multi-perspective bookkeeping: local mirror of perspectiveResponses
      // (state updates are async, so we need a synchronous accumulator) plus
      // which models have individually reported `done`.
      const perspectiveText: Record<string, string> = {
        [activeParallelModel1]: '',
        [activeParallelModel2]: '',
      };
      const perspectiveDone = new Set<string>();

      const flagPossibleModelError = (content: string) => {
        if (
          content.includes('Provider Error') ||
          content.includes('rate limit') ||
          content.includes('quota') ||
          content.includes('limit exceeded') ||
          content.includes('Systems Notice') ||
          content.includes('Provider returned error')
        ) {
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
      };

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

            if (actualRunParallel) {
              // Multiplexed protocol: each chunk is tagged with which model
              // it belongs to. A `done` with no `model` field means BOTH
              // models have finished and the whole exchange is complete.
              if (data.model) {
                if (typeof data.content === 'string' && data.content) {
                  perspectiveText[data.model] = (perspectiveText[data.model] || '') + data.content;
                  flagPossibleModelError(data.content);
                }
                if (data.done) {
                  perspectiveDone.add(data.model);
                  setPerspectiveDoneModels(new Set(perspectiveDone));
                }
                setPerspectiveResponses({ ...perspectiveText });

                setTimeout(() => {
                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
                continue;
              }

              if (data.done) {
                setIsProcessing(false);
                setAbortController(null);
                setHistory(prev => [
                  ...prev,
                  {
                    query: trimmedQuery,
                    response: [activeParallelModel1, activeParallelModel2]
                      .map(m => `[${m}] ${perspectiveText[m] || ''}`)
                      .join('\n\n'),
                    model: selectedModelId,
                    image: selectedImage || undefined,
                    perspectives: [activeParallelModel1, activeParallelModel2].map(m => ({
                      model: m,
                      content: perspectiveText[m] || '',
                    })),
                  },
                ]);
                setPerspectiveResponses(null);
                setPerspectiveDoneModels(new Set());
                setQuery('');
                setSelectedImage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
                setTimeout(() => {
                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
                return;
              }
              continue;
            }

            if (data.content) {
              fullResponse += data.content;
              setResponse(fullResponse);
              flagPossibleModelError(data.content);

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
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              // Auto-scroll to bottom after adding to history
              setTimeout(() => {
                responseEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
              return;
            }
          } catch {
            // Skip invalid JSON
            continue;
          }
        }
      }
    } catch (caughtError) {
      const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
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
          handleSubmit(e);
        }
      }
      // Escape to stop
      if (e.key === 'Escape' && isProcessing) {
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handleSubmit/handleStop intentionally omitted: they're recreated every
    // render (not memoized) and this effect already re-subscribes on every
    // query/isProcessing change, so including them would add churn with no
    // behavioral difference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isProcessing]);

  // Shared react-markdown `code` renderer (copy-to-clipboard code blocks) -
  // reused by every ReactMarkdown instance on this page (history entries,
  // the live single-model response, and each Multi-Perspective card) so the
  // block isn't copy-pasted per call site.
  const markdownComponents = {
    code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      const isCopied = copiedCodeBlock === code;
      // react-markdown v9+ no longer passes an `inline` prop - block
      // code is the only kind that gets a `language-x` className from
      // rehype-highlight, so its presence is the reliable signal.
      const isInline = !className;

      return !isInline ? (
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
  };

  // Small 3-dot bounce loader, reused for both the single-model "processing"
  // state and each Multi-Perspective card while that model is still
  // streaming. A plain element (not a component defined at render-time) so
  // it's safe to reuse across multiple spots in the JSX below.
  const bounceLoader = (
    <div className="flex space-x-1 h-6 items-center">
      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-[var(--foreground)]/40 rounded-full animate-bounce"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden transition-colors duration-500 flex flex-col">
      {/* Neural Noise and Audio Visualizer removed - using R3F visualizer instead */}

      {/* R3F Visualizer */}
      {visualizerEnabled && (
        <R3FVisualizer
          mode={visualizerMode}
          speed={visualizerSpeed}
          color1={visualizerColor1}
          color2={visualizerColor2}
          density={visualizerDensity}
          invertY={visualizerInvertY}
          scaleY={visualizerScaleY}
          maxAmplitude={maxAmplitude}
          waveFreq={waveFreq}
          waveFormDouble={waveFormDouble}
          autoOrbit={autoOrbit}
          audioLevelRef={micLevelRef}
        />
      )}

      {/* Visualizer Configuration Panel */}
      <VisualizerConfigPanel
        isOpen={visualizerConfigOpen}
        onClose={() => setVisualizerConfigOpen(false)}
        enabled={visualizerEnabled}
        onEnabledChange={setVisualizerEnabled}
        mode={visualizerMode}
        onModeChange={setVisualizerMode}
        onColor1Change={setVisualizerColor1}
        onColor2Change={setVisualizerColor2}
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
          setVisualizerInvertY(false);
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

      {/* Animated Background - opacity-only + GPU-composited so the
          continuous pulse doesn't repaint every frame; smaller/lighter on
          mobile where the blur radius is otherwise a real GPU cost. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none [contain:strict]">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 bg-[var(--accent)]/10 rounded-full blur-2xl md:blur-3xl animate-pulse [will-change:opacity] [transform:translateZ(0)]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 bg-[var(--accent)]/5 rounded-full blur-2xl md:blur-3xl animate-pulse delay-1000 [will-change:opacity] [transform:translateZ(0)]"></div>
      </div>

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border)] transition-opacity duration-500 ${focusMode ? 'opacity-0 hover:opacity-100 pointer-events-none hover:pointer-events-auto' : 'opacity-100'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-5">
              <button
                onClick={() => setIsChatMode(false)}
                className="serif-display text-xl text-[var(--foreground)] hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]"
              >
                Roovert
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-strong)] border border-[var(--border)] transition-all text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
              <div className="hidden sm:block">
                <NavClock />
              </div>
            </div>

            {/* Theme + Visualizer controls - Center */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1 sm:gap-1.5 p-1 rounded-full bg-[var(--surface)] border border-[var(--border)]">
              <button
                onClick={() => setIsLooksOpen(true)}
                className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-[var(--surface-strong)] transition-all text-[var(--muted)] hover:text-[var(--foreground)]"
                title="Change Theme"
              >
                <Paintbrush className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVisualizerConfigOpen(true)}
                aria-pressed={visualizerEnabled}
                className={`relative overflow-visible flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all group ${visualizerEnabled
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'hover:bg-[var(--surface-strong)] text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                title={visualizerEnabled ? 'Listening — audio-reactive visualizer on' : 'Audio-Reactive Visualizer (uses microphone)'}
              >
                {visualizerEnabled && (
                  <>
                    {/* Outer ring: eases outward with real mic level via spring
                        physics, like a voice-mode "listening" indicator rather
                        than a generic looping CSS animation. */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-[var(--accent)]/50"
                      animate={{ scale: 1 + micLevel * 0.85, opacity: 0.55 - micLevel * 0.25 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 15, mass: 0.5 }}
                    />
                    {/* Inner glow: fills in with level, giving the button real
                        depth instead of a flat active-state color swap. */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-1 rounded-full bg-[var(--accent)]/25 blur-[2px]"
                      animate={{ scale: 1 + micLevel * 0.5, opacity: 0.4 + micLevel * 0.6 }}
                      transition={{ type: 'spring', stiffness: 180, damping: 14, mass: 0.4 }}
                    />
                    {/* Slow idle breathing ring so the button still reads as
                        "alive" during silence, not just when there's sound. */}
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-[var(--accent)]/25"
                      animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                  </>
                )}
                <Waves className="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-7">
              <button
                onClick={() => setIsGlobalFeedOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--surface)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                title="Global Feed"
              >
                <Globe className="w-4 h-4" />
              </button>
              {!isChatMode && (
                <>
                  <a
                    href="#mission"
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Mission
                  </a>
                  <Link
                    href="/careers"
                    className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Careers
                  </Link>
                  {!focusMode && <LiveStats />}
                </>
              )}
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
            neuralNoiseEnabled={neuralNoiseEnabled}
            setNeuralNoiseEnabled={setNeuralNoiseEnabled}
            availableModels={availableModels}
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

      {/* More Models Modal */}
      <AnimatePresence>
        {isMoreModelsOpen && (
          <MoreModelsModal
            isOpen={isMoreModelsOpen}
            onClose={() => setIsMoreModelsOpen(false)}
            models={filteredAvailableModels}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            onInitialize={handleInitialize}
          />
        )}
      </AnimatePresence>

      {/* Interactive Particle Background for Deep Space Look */}

      {/* Main Content Area */}
      <main id="main-content" className="theme-shell relative z-10 flex-1 flex flex-col px-6 pt-32 pb-20 overflow-y-auto overflow-x-hidden">

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
              className="flex flex-col items-center text-center max-w-5xl mx-auto space-y-10 pt-12 pb-16"
            >
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="label inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                Engine of Truth
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="serif-display text-6xl sm:text-7xl md:text-8xl leading-[1.02] text-balance text-[var(--foreground)]"
              >
                <span className="block">Multi-Perspective</span>
                <span className="block text-[var(--accent)]">AI Models</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto leading-relaxed text-balance"
              >
                Advanced intelligence designed to challenge consensus. Powered by{' '}
                <span className="text-[var(--foreground)]">
                  {selectedModelId === 'multi-perspective' ? 'multiple models at once' : selectedModel.name}
                </span>.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="flex flex-wrap items-center justify-center gap-3 pt-2"
              >
                <button
                  onClick={handleInitialize}
                  className="px-8 py-3.5 bg-[var(--accent)] text-white text-base font-medium rounded-full transition-all duration-[var(--duration-base)] hover:opacity-90 active:scale-[0.98] shadow-[var(--shadow-md)] flex items-center gap-2"
                >
                  Start a conversation <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsLooksOpen(true)}
                  className="px-6 py-3.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)] hover:border-[var(--accent)]/40 rounded-full transition-all duration-[var(--duration-base)] flex items-center gap-2"
                >
                  <Paintbrush className="w-4 h-4" /> Explore Looks
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3 w-full max-w-2xl pt-4`}
              >
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
                    onClick={() => injectPrompt(prompt)}
                    className="card-hover bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4 text-sm text-left text-[var(--muted)] hover:text-[var(--foreground)] leading-relaxed"
                  >
                    {prompt}
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Section (Shown when NOT in Chat Mode) */}
        {!isChatMode && (
          <div className="w-full max-w-7xl mx-auto mt-8 space-y-16 pb-20">

            {/* Browse AI Models */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="serif-display text-2xl text-[var(--foreground)]">Browse AI Models</h2>
                </div>
                <button
                  onClick={() => setIsMoreModelsOpen(true)}
                  className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  View All Models <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAvailableModels.slice(0, 6).map((model, idx) => (
                  <motion.div
                    key={model.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4 }}
                    onClick={() => {
                      setSelectedModelId(model.id);
                      handleInitialize();
                    }}
                    className="card-hover bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)]/12 flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-colors">
                        {(() => {
                          const CategoryIcon = model.category === 'OpenRouter' ? Globe
                            : model.category === 'Premium' ? Sparkles
                            : model.category === 'Advanced' ? Star
                            : Zap;
                          return <CategoryIcon className="w-4 h-4 text-[var(--accent)]" />;
                        })()}
                      </div>
                      <span className="label px-2 py-1 rounded-full border border-[var(--border)]">
                        {model.category}
                      </span>
                    </div>
                    <h3 className="text-base font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-1.5">
                      {model.name}
                    </h3>
                    <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-2">{model.description}</p>
                  </motion.div>
                ))}
              </div>
            </section>


            {/* Code Examples */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Code className="w-5 h-5 text-[var(--accent)]" />
                  <h2 className="serif-display text-2xl text-[var(--foreground)]">Code Examples</h2>
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
                    className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5"
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
                        <span className="label">Active Intelligence</span>
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
                        <span className="label">Ops Snapshot</span>
                        <div className="mt-4 space-y-4">
                          {SIGNALS.map(signal => (
                            <div key={signal.title}>
                              <p className="label">{signal.title}</p>
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

                  <div className={`overflow-y-auto custom-scrollbar ${isMobile ? 'pr-2' : 'pr-4'}`} style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '200px' }}>
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
                                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/20 flex-shrink-0">
                                    <Zap className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="label text-[var(--accent)] mb-2">
                                      You
                                    </div>
                                    {entry.image && (
                                      <div className="mb-3 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-strong)]">
                                        {/* eslint-disable-next-line @next/next/no-img-element -- client-side base64 data URL, not a next/image-optimizable asset */}
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
                                className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-6"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="label text-[var(--accent)]">
                                        {filteredAvailableModels.find(m => m.id === entry.model)?.name || availableModels.find(m => m.id === entry.model)?.name || 'AI'}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setQuery(entry.query);
                                            setSelectedImage(entry.image || null);
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
                                                const content: ChatContent = h.image
                                                  ? [
                                                    { type: 'text', text: h.query },
                                                    { type: 'image_url', image_url: { url: h.image } },
                                                  ]
                                                  : h.query;
                                                return [
                                                  { role: 'user' as const, content },
                                                  { role: 'assistant' as const, content: h.response },
                                                ];
                                              }).flat();

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
                                                  } catch { }
                                                }
                                              }
                                            } catch (caughtError) {
                                              const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
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
                                    {entry.perspectives && entry.perspectives.length > 0 ? (
                                      <div className="grid md:grid-cols-2 gap-4">
                                        {entry.perspectives.map((p) => (
                                          <div
                                            key={p.model}
                                            className="glass-panel card-hover bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
                                          >
                                            <div className="label text-[var(--accent)] mb-2">
                                              {availableModels.find(m => m.id === p.model)?.name || p.model}
                                            </div>
                                            <div className="text-[var(--foreground)] text-base leading-relaxed font-light markdown-content">
                                              <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                                disallowedElements={['script', 'iframe', 'object', 'embed']}
                                                unwrapDisallowed={true}
                                                components={markdownComponents}
                                              >
                                                {p.content}
                                              </ReactMarkdown>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[var(--foreground)] text-lg leading-relaxed font-light markdown-content">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                          rehypePlugins={[rehypeHighlight]}
                                          // Security: Disable HTML rendering to prevent XSS
                                          disallowedElements={['script', 'iframe', 'object', 'embed']}
                                          unwrapDisallowed={true}
                                          components={markdownComponents}
                                        >
                                          {entry.response}
                                        </ReactMarkdown>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Current Response (if processing or showing latest) */}
                    <AnimatePresence mode="popLayout">
                      {(response || isProcessing || perspectiveResponses) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="glass-panel bg-[var(--panel-bg)] backdrop-blur-xl border border-[var(--border)] rounded-2xl p-8 mb-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-2 rounded-lg bg-[var(--accent)]/10 flex-shrink-0">
                              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                            </div>
                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="label text-[var(--accent)]">
                                {perspectiveResponses
                                  ? 'Comparing Perspectives…'
                                  : isProcessing ? 'Processing…' : `Response from ${selectedModel.name}`}
                              </div>
                              {!isProcessing && statusNote && (
                                <div className="label">
                                  {statusNote}
                                </div>
                              )}
                              {perspectiveResponses ? (
                                <div className="space-y-3">
                                  <button
                                    onClick={handleStop}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--surface)] hover:border-[var(--accent)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                                  >
                                    <Square className="w-3 h-3" />
                                    Stop
                                  </button>
                                <div className="grid md:grid-cols-2 gap-4">
                                  {Object.entries(perspectiveResponses).map(([modelId, content]) => {
                                    const isDone = perspectiveDoneModels.has(modelId);
                                    return (
                                      <div
                                        key={modelId}
                                        className="glass-panel card-hover bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4"
                                      >
                                        <div className="label text-[var(--accent)] mb-2">
                                          {availableModels.find(m => m.id === modelId)?.name || modelId}
                                        </div>
                                        {!isDone && (
                                          <div className="mb-2">
                                            {bounceLoader}
                                          </div>
                                        )}
                                        {content && (
                                          <div className="text-[var(--foreground)] text-base leading-relaxed font-light markdown-content">
                                            <ReactMarkdown
                                              remarkPlugins={[remarkGfm]}
                                              rehypePlugins={[rehypeHighlight]}
                                              disallowedElements={['script', 'iframe', 'object', 'embed']}
                                              unwrapDisallowed={true}
                                              components={markdownComponents}
                                            >
                                              {content}
                                            </ReactMarkdown>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  </div>
                                </div>
                              ) : (
                                <div className="prose prose-invert max-w-none">
                                  {isProcessing ? (
                                    <div className="flex items-center gap-3">
                                      {bounceLoader}
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
                                        components={markdownComponents}
                                      >
                                        {response}
                                      </ReactMarkdown>
                                    </div>
                                  ) : null}
                                </div>
                              )}
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

                    {/* Auto-scroll anchor - always at the bottom */}
                    <div ref={responseEndRef} />
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Input Deck - Fixed at bottom for chat mode */}
      {isChatMode && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/95 backdrop-blur-xl border-t border-[var(--border)] ${isMobile ? 'p-3' : 'p-4'}`}
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), var(--space-3, 0.75rem))' }}
        >
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- client-side base64 data URL, not a next/image-optimizable asset */}
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
              <div className={`composer-bar glass-panel relative bg-[var(--panel-bg)] backdrop-blur-2xl border border-[var(--border)] ${isMobile ? 'p-3' : 'p-4'} transition-all duration-300`}>
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

                  {/* Multi-Perspective Model Selectors - Only shown when Multi-Perspective is selected */}
                  {selectedModelId === 'multi-perspective' && (
                    <div className="flex items-center gap-2 border-r border-[var(--border)] pr-3">
                      <span className="text-xs text-[var(--muted)] whitespace-nowrap">Combine:</span>
                      <select
                        value={parallelModel1}
                        onChange={(e) => setParallelModel1(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors outline-none"
                      >
                        {groqOnlyModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-xs text-[var(--accent)]">+</span>
                      <select
                        value={parallelModel2}
                        onChange={(e) => setParallelModel2(e.target.value)}
                        className="px-2 py-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--accent)]/50 transition-colors outline-none"
                      >
                        {groqOnlyModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Attach Image */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImageUploadDisabled}
                    className="p-2 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title={isImageUploadDisabled ? `Image upload disabled: ${imageUploadDisabledReason}` : 'Attach image'}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg hover:bg-[var(--surface-strong)] transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
                    title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
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
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    aria-label="Query input"
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || isProcessing}
                    className="flex items-center justify-center w-12 h-12 p-0 bg-[var(--accent)] hover:opacity-90 hover:scale-105 active:scale-95 rounded-xl disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all duration-[var(--duration-fast)] shadow-[0_4px_20px_-4px_var(--accent-glow)]"
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
          <section id="mission" className="relative z-10 py-32 border-t border-[var(--border)]">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <h2 className="serif-display text-4xl mb-8 text-[var(--foreground)]">Our Mission</h2>
              <p className="text-xl text-[var(--muted)] leading-relaxed">
                In an era of curated realities and algorithmic bias, truth has become a scarcity.
                Roovert exists to reverse this entropy. We are building the world&apos;s most rigorous
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
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-12"
              >
                <div className="flex items-center gap-3 mb-6">
                  <Code className="w-6 h-6 text-[var(--accent)]" />
                  <h2 className="serif-display text-3xl text-[var(--foreground)]">Built With Itself</h2>
                </div>
                <div className="space-y-6 text-[var(--foreground)]/80 leading-relaxed">
                  <p className="text-lg">
                    Here&apos;s something interesting: large portions of Roovert were built using Roovert itself.
                  </p>
                  <p>
                    The code you&apos;re reading, the components rendering on this page, the API routes handling your requests—many of them started as conversations with the AI models powering this interface. We asked questions, refined prompts, iterated on responses, and built features in real-time through the same chat interface you&apos;re using now.
                  </p>
                  <p>
                    This isn&apos;t a gimmick. It&apos;s a practical demonstration of what happens when you treat AI as a first-class development tool rather than a novelty. The privacy policy, the consent banner, the visitor tracking system, the UI components—all of it emerged from iterative conversations where we challenged assumptions, tested implementations, and refined code until it worked.
                  </p>
                  <p>
                    There&apos;s something recursive about building an AI interface with AI. You end up with a product that understands its own construction, that can explain its architecture, that knows why certain decisions were made. It creates a kind of self-awareness in the codebase that traditional development doesn&apos;t usually achieve.
                  </p>
                  <p className="text-[var(--accent)] font-medium">
                    We&apos;re not just building tools for AI. We&apos;re building tools with AI, and that changes everything.
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
