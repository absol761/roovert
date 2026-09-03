import { describe, expect, test, afterEach } from 'vitest';
import { quadrantRect } from './FloatingChatWindow';

// Regression test for: quadrantRect (the corner-snap target computed when a
// dragged floating window is released near a screen edge) used to compute
// each quadrant as a literal half of the viewport
// (innerWidth/2 - margin, innerHeight/2 - margin) with no floor. On any
// viewport narrower than ~664px or shorter than ~744px - not exotic, e.g.
// two browser windows split side-by-side on a laptop, or a narrowed dev
// window - that produced a snapped size smaller than MIN_WIDTH/MIN_HEIGHT
// (320x360), the very minimum the window's own drag-resize handles enforce
// elsewhere. The window would render narrower/shorter than the size its
// header/input row need, clipping content. Fixed by flooring the computed
// size at the component's minimum and capping it at the available space so
// right/bottom-anchored quadrants stay fully on-screen even when the
// floored size is larger than half the viewport.
//
// This repo has no jsdom/testing-library, so quadrantRect is exercised
// directly with a minimal `window` stub exposing only the two properties it
// reads, rather than mounting the component.
type WindowStub = { innerWidth: number; innerHeight: number };
// Cast through `unknown` rather than intersecting with `typeof globalThis`:
// the real `window` global is typed as the full DOM `Window` interface, so
// an intersection would reject assigning our minimal stub. quadrantRect only
// ever reads innerWidth/innerHeight, so the stub is all it needs at runtime.
type GlobalWithWindow = { window?: WindowStub };

function withViewport<T>(innerWidth: number, innerHeight: number, fn: () => T): T {
  const globalWithWindow = globalThis as unknown as GlobalWithWindow;
  const original = globalWithWindow.window;
  globalWithWindow.window = { innerWidth, innerHeight };
  try {
    return fn();
  } finally {
    globalWithWindow.window = original;
  }
}

afterEach(() => {
  delete (globalThis as unknown as GlobalWithWindow).window;
});

describe('quadrantRect', () => {
  test('never snaps a quadrant smaller than the window minimum size on a narrow/short viewport', () => {
    withViewport(600, 700, () => {
      for (const quadrant of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
        const rect = quadrantRect(quadrant);
        expect(rect.width).toBeGreaterThanOrEqual(320);
        expect(rect.height).toBeGreaterThanOrEqual(360);
      }
    });
  });

  test('keeps right/bottom-anchored quadrants fully on-screen when the floored size exceeds half the viewport', () => {
    withViewport(600, 700, () => {
      const topRight = quadrantRect('top-right');
      const bottomRight = quadrantRect('bottom-right');
      expect(topRight.x).toBeGreaterThanOrEqual(0);
      expect(topRight.x + topRight.width).toBeLessThanOrEqual(600);
      expect(bottomRight.y).toBeGreaterThanOrEqual(0);
      expect(bottomRight.y + bottomRight.height).toBeLessThanOrEqual(700);
    });
  });

  test('matches the original half-viewport sizing/position on a normal-sized viewport', () => {
    withViewport(1600, 1000, () => {
      const rect = quadrantRect('bottom-right');
      expect(rect.width).toBeCloseTo(1600 / 2 - 12, 5);
      expect(rect.height).toBeCloseTo(1000 / 2 - 12, 5);
      expect(rect.x).toBeCloseTo(1600 / 2 + 4, 5);
      expect(rect.y).toBeCloseTo(1000 / 2 + 4, 5);
    });
  });
});
