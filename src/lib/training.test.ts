import { describe, expect, it, vi } from 'vitest';
import { COUNTRIES } from '../data/countries';
import {
  difficulty,
  loadTrainingMode,
  loadTrainingStats,
  recordAnswer,
  saveTrainingMode,
  saveTrainingStats,
  trainingCountries,
  weightedSample,
} from './training';
import { seededRng } from './random';

describe('training stats', () => {
  it('wrong answers raise difficulty, correct ones lower it', () => {
    let stats = recordAnswer({}, 'capital', 'France', false);
    expect(difficulty(stats, 'capital', 'France')).toBeCloseTo(1);
    stats = recordAnswer(stats, 'capital', 'France', false);
    expect(difficulty(stats, 'capital', 'France')).toBeCloseTo(1.7);
    stats = recordAnswer(stats, 'capital', 'France', true);
    expect(difficulty(stats, 'capital', 'France')).toBeCloseTo(0.19);
  });

  it('tracks games separately', () => {
    const stats = recordAnswer({}, 'map', 'France', false);
    expect(difficulty(stats, 'flag', 'France')).toBe(0);
    expect(difficulty(stats, 'capital', 'France')).toBe(0);
  });

  it('records daily capital-of questions under the capital game', () => {
    const stats = recordAnswer({}, 'capital-of', 'Burkina Faso', false);
    expect(difficulty(stats, 'capital', 'Burkina Faso')).toBeCloseTo(1);
  });

  it('repeated correct answers unstick a question', () => {
    let stats = {};
    for (let i = 0; i < 5; i++) stats = recordAnswer(stats, 'map', 'Chad', false);
    expect(difficulty(stats, 'map', 'Chad')).toBeGreaterThan(2);
    for (let i = 0; i < 3; i++) stats = recordAnswer(stats, 'map', 'Chad', true);
    expect(difficulty(stats, 'map', 'Chad')).toBeLessThanOrEqual(0);
  });
});

describe('training selection', () => {
  it('puts hard questions first and fills the rest with random ones', () => {
    let stats = {};
    for (const n of ['Chad', 'Mali', 'Peru']) stats = recordAnswer(stats, 'map', n, false);
    const picked = trainingCountries(COUNTRIES, 10, 'map', stats, seededRng('order'));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked.slice(0, 3).map((c) => c.name).sort()).toEqual(['Chad', 'Mali', 'Peru']);
  });

  it('is plain random when there is no history', () => {
    const picked = trainingCountries(COUNTRIES, 10, 'flag', {}, seededRng('none'));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
  });

  it('includes every country when asked for all of them, hard ones first', () => {
    let stats = {};
    stats = recordAnswer(stats, 'capital', 'France', false);
    stats = recordAnswer(stats, 'capital', 'Japan', false);
    const picked = trainingCountries(COUNTRIES, COUNTRIES.length, 'capital', stats, seededRng('all'));
    expect(picked).toHaveLength(COUNTRIES.length);
    expect(new Set(picked).size).toBe(COUNTRIES.length);
    expect(picked.slice(0, 2).map((c) => c.name).sort()).toEqual(['France', 'Japan']);
  });

  it('weighs the hardest questions more heavily than the merely hard', () => {
    let stats = {};
    for (let i = 0; i < 3; i++) stats = recordAnswer(stats, 'flag', 'Chad', false);
    for (const n of ['Mali', 'Peru', 'Fiji', 'Togo']) stats = recordAnswer(stats, 'flag', n, false);
    const rng = seededRng('hard');
    let chadPicked = 0;
    for (let i = 0; i < 50; i++) {
      const picked = trainingCountries(COUNTRIES, 4, 'flag', stats, rng);
      expect(picked).toHaveLength(4);
      if (picked.some((c) => c.name === 'Chad')) chadPicked++;
    }
    // Three of the five hard countries make each quiz; Chad is ~2.2x as heavy
    // as the others, so it should be picked far more than half the time.
    expect(chadPicked).toBeGreaterThan(30);
  });

  it('keeps the quiz at full length when there are few hard questions', () => {
    let stats = {};
    stats = recordAnswer(stats, 'map', 'Chad', false);
    const picked = trainingCountries(COUNTRIES, 10, 'map', stats, seededRng('sparse'));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked[0].name).toBe('Chad');
  });
});

describe('weighted sampling', () => {
  it('picks without replacement in proportion to weight', () => {
    const rng = seededRng('weights');
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 300; i++) {
      const pick = weightedSample(['a', 'b', 'c'], (x) => (x === 'a' ? 3 : 1), 1, rng)[0];
      counts[pick]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.a).toBeGreaterThan(counts.c);
    expect(counts.b).toBeGreaterThan(0);
    expect(counts.c).toBeGreaterThan(0);
  });
});

describe('training storage', () => {
  it('round-trips stats and the mode toggle through localStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const stats = recordAnswer({}, 'map', 'France', false);
    saveTrainingStats(stats);
    expect(loadTrainingStats()).toEqual(stats);
    saveTrainingMode(true);
    expect(loadTrainingMode()).toBe(true);
    saveTrainingMode(false);
    expect(loadTrainingMode()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('ignores malformed stored stats', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'gk-training' ? '{"map:France":{"w":1,"r":0},"bad":42,"weird":{"w":"x","r":1}}' : null),
      setItem: () => {},
    });
    expect(loadTrainingStats()).toEqual({ 'map:France': { w: 1, r: 0 } });
    expect(loadTrainingMode()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('returns empty stats when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => {} });
    expect(loadTrainingStats()).toEqual({});
    expect(() => saveTrainingStats({})).not.toThrow();
    vi.unstubAllGlobals();
  });
});
