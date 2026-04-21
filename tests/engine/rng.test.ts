import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/engine/rng.js';

describe('SeededRNG', () => {
  it('produces deterministic sequences from the same seed', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences from different seeds', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('d8() returns values from 1 to 8', () => {
    const rng = new SeededRNG(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.d8();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(8);
      seen.add(v);
    }
    // After 1000 rolls we should have seen all 8 values
    expect(seen.size).toBe(8);
  });

  it('roll(N) returns values from 1 to N', () => {
    const rng = new SeededRNG(77);
    for (const sides of [4, 6, 8, 10, 12, 20]) {
      for (let i = 0; i < 100; i++) {
        const v = rng.roll(sides);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(sides);
      }
    }
  });

  it('saves and restores state correctly', () => {
    const rng = new SeededRNG(42);
    // Advance a few steps
    for (let i = 0; i < 10; i++) rng.next();

    const savedState = rng.getState();
    const nextValues = Array.from({ length: 5 }, () => rng.next());

    // Restore and verify same sequence continues
    const restored = SeededRNG.fromState(42, savedState);
    const restoredValues = Array.from({ length: 5 }, () => restored.next());
    expect(restoredValues).toEqual(nextValues);
  });

  it('exposes the original seed', () => {
    const rng = new SeededRNG(12345);
    expect(rng.seed).toBe(12345);
  });

  it('has roughly uniform distribution', () => {
    const rng = new SeededRNG(555);
    const buckets = new Array(8).fill(0);
    const rolls = 10000;
    for (let i = 0; i < rolls; i++) {
      buckets[rng.d8() - 1]++;
    }
    const expected = rolls / 8;
    for (const count of buckets) {
      // Each bucket should be within 20% of expected
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});
