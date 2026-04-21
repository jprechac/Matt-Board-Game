/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Deterministic: same seed always produces the same sequence.
 */
export class SeededRNG {
  private _state: number;
  private readonly _seed: number;

  constructor(seed: number) {
    this._seed = seed;
    this._state = seed | 0;
  }

  /** Returns a float in [0, 1) */
  next(): number {
    this._state = (this._state + 0x6D2B79F5) | 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Roll a d8 (returns 1–8) */
  d8(): number {
    return Math.floor(this.next() * 8) + 1;
  }

  /** Roll a dN (returns 1–N) */
  roll(sides: number): number {
    return Math.floor(this.next() * sides) + 1;
  }

  /** The initial seed */
  get seed(): number {
    return this._seed;
  }

  /** Current internal state for serialization */
  getState(): number {
    return this._state;
  }

  /** Restore RNG from a previously saved state */
  static fromState(seed: number, state: number): SeededRNG {
    const rng = new SeededRNG(seed);
    rng._state = state;
    return rng;
  }
}
