'use client';

import { useState } from 'react';
import type { VisualizerMode } from '../components/visualizer/R3FVisualizer';

// All the state behind the R3F background visualizer + its config panel:
// on/off, nav-button visibility, and every tunable (mode, colors, wave
// form, grid preset, palette, ...). Grouped into one hook because it's a
// large, self-contained settings bundle with no cross-dependencies on the
// rest of the page beyond the mic stream (which the caller still owns via
// useMicLevel(visualizerEnabled), since that hook needs `visualizerEnabled`
// before this one's other values are relevant).
export function useVisualizerSettings() {
  // Visualizer state - the app ships a full react-three-fiber background
  // visualizer + config panel; it previously had no way to ever be enabled
  // or opened (dead feature) and wasn't actually audio-reactive despite the
  // name (its "audioIntensity" was driven by mouse movement, unused). Now
  // reachable via the nav's Waves button, genuinely reacts to real audio via
  // the mic, and stays off by default since enabling it requests mic access.
  const [visualizerEnabled, setVisualizerEnabled] = useState(false);
  // Gates whether the nav's Waves button (the only entry point to the
  // visualizer/config panel) renders at all. Off by default so the feature
  // is fully hidden from the landing page until explicitly turned on in
  // Settings; turning it back off also force-disables the visualizer itself
  // so it can't keep running with its only control gone.
  const [showVisualizerButton, setShowVisualizerButtonState] = useState(false);
  const [visualizerConfigOpen, setVisualizerConfigOpen] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('orb');
  const [visualizerSpeed, setVisualizerSpeed] = useState(0.3);
  const [visualizerColor1, setVisualizerColor1] = useState('#4a90e2');
  const [visualizerColor2, setVisualizerColor2] = useState('#7b68ee');
  const [visualizerDensity, setVisualizerDensity] = useState(0.5);
  const [visualizerInvertY, setVisualizerInvertY] = useState(false);
  const [visualizerScaleY, setVisualizerScaleY] = useState(true);
  // Wave form settings
  const [waveFormPreset, setWaveFormPreset] = useState<'default' | 'custom'>('default');
  const [waveFormDouble, setWaveFormDouble] = useState(false);
  const [maxAmplitude, setMaxAmplitude] = useState(1.36);
  const [waveFreq, setWaveFreq] = useState(2.0);
  // General settings
  const [colorBackground, setColorBackground] = useState(false);
  const [colorsFollowMusic, setColorsFollowMusic] = useState(false);
  const [autoOrbit, setAutoOrbit] = useState(false);
  // Grid presets
  const [gridPreset, setGridPreset] = useState<'default' | 'bands' | 'custom'>('default');
  // Palette selection
  const [selectedPalette, setSelectedPalette] = useState(0);

  // The nav button is the visualizer's only on/off control - hiding it
  // while the visualizer is still running would leave it stuck on with no
  // way to turn it off.
  const setShowVisualizerButton = (value: boolean) => {
    setShowVisualizerButtonState(value);
    if (!value) {
      setVisualizerEnabled(false);
    }
  };

  // Single click both toggles the visualizer directly (this control
  // visually reads as a toggle, so it needs to behave like one) and opens
  // the settings panel so mode/color options stay reachable - shared by the
  // desktop SidebarRail and mobile MobileNav's Waves buttons.
  const toggleVisualizerFromNav = () => {
    setVisualizerEnabled(!visualizerEnabled);
    setVisualizerConfigOpen(true);
  };

  const resetVisualizerSettings = () => {
    setVisualizerMode('orb');
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
  };

  return {
    visualizerEnabled,
    setVisualizerEnabled,
    showVisualizerButton,
    setShowVisualizerButton,
    visualizerConfigOpen,
    setVisualizerConfigOpen,
    visualizerMode,
    setVisualizerMode,
    visualizerSpeed,
    setVisualizerSpeed,
    visualizerColor1,
    setVisualizerColor1,
    visualizerColor2,
    setVisualizerColor2,
    visualizerDensity,
    setVisualizerDensity,
    visualizerInvertY,
    setVisualizerInvertY,
    visualizerScaleY,
    setVisualizerScaleY,
    waveFormPreset,
    setWaveFormPreset,
    waveFormDouble,
    setWaveFormDouble,
    maxAmplitude,
    setMaxAmplitude,
    waveFreq,
    setWaveFreq,
    colorBackground,
    setColorBackground,
    colorsFollowMusic,
    setColorsFollowMusic,
    autoOrbit,
    setAutoOrbit,
    gridPreset,
    setGridPreset,
    selectedPalette,
    setSelectedPalette,
    toggleVisualizerFromNav,
    resetVisualizerSettings,
  };
}
