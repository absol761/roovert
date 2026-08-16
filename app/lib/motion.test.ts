import { describe, it, expect } from 'vitest';
import { EASE_OUT, DURATION_BASE, MODAL_TRANSITION } from './motion';

describe('EASE_OUT', () => {
  it('matches the --ease-out cubic-bezier values from globals.css', () => {
    expect(EASE_OUT).toEqual([0.16, 1, 0.3, 1]);
  });
});

describe('DURATION_BASE', () => {
  it('matches the --duration-base value of 250ms expressed in seconds', () => {
    expect(DURATION_BASE).toBe(0.25);
  });
});

describe('MODAL_TRANSITION', () => {
  it('combines DURATION_BASE and EASE_OUT into a single tween config', () => {
    expect(MODAL_TRANSITION).toEqual({ duration: DURATION_BASE, ease: EASE_OUT });
  });

  it('references the same EASE_OUT array rather than a divergent copy', () => {
    expect(MODAL_TRANSITION.ease).toBe(EASE_OUT);
  });
});
