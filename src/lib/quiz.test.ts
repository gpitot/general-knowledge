import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '../data/countries';
import { isCorrect, normalize, suggest } from './answers';
import { focusBounds, loadFeatures, markerPoints } from './geo';

const byName = (n: string) => COUNTRIES.find((c) => c.name === n)!;

describe('country data', () => {
  const features = loadFeatures();

  it('has 196 unique countries', () => {
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(196);
  });

  it('maps every country (and included territory) to a map shape', () => {
    const missing = COUNTRIES.flatMap((c) => [c.atlas ?? c.name, ...(c.includes ?? [])]).filter((n) => !features.has(n));
    expect(missing).toEqual([]);
  });

  it('has no alias that matches two countries', () => {
    const seen = new Map<string, string>();
    for (const c of COUNTRIES) {
      for (const form of [c.name, ...(c.aliases ?? [])]) {
        const n = normalize(form);
        expect(seen.get(n) ?? c.name, `"${form}"`).toBe(c.name);
        seen.set(n, c.name);
      }
    }
  });
});

describe('answers', () => {
  it('ignores case, accents, punctuation and "the"', () => {
    expect(isCorrect('cote divoire', byName("Côte d'Ivoire"))).toBe(true);
    expect(isCorrect('  FRANCE ', byName('France'))).toBe(true);
    expect(isCorrect('the gambia', byName('Gambia'))).toBe(true);
    expect(isCorrect('St. Lucia', byName('Saint Lucia'))).toBe(true);
    expect(isCorrect('Bosnia & Herzegovina', byName('Bosnia and Herzegovina'))).toBe(true);
  });

  it('accepts aliases but not other countries', () => {
    expect(isCorrect('USA', byName('United States'))).toBe(true);
    expect(isCorrect('Burma', byName('Myanmar'))).toBe(true);
    expect(isCorrect('Niger', byName('Nigeria'))).toBe(false);
    expect(isCorrect('', byName('France'))).toBe(false);
  });

  it('suggests prefix matches first', () => {
    const names = suggest('ni', COUNTRIES).map((s) => s.country.name);
    expect(names.slice(0, 3)).toEqual(['Nicaragua', 'Niger', 'Nigeria']);
    expect(suggest('ivory', COUNTRIES)[0]).toMatchObject({ country: { name: "Côte d'Ivoire" }, via: 'Ivory Coast' });
  });
});

describe('geometry', () => {
  const features = loadFeatures();
  const bounds = (n: string) => focusBounds([features.get(n)!]);

  it('frames France on Europe, not French Guiana', () => {
    const [[s, w], [n, e]] = bounds('France');
    expect(s).toBeGreaterThan(40);
    expect(w).toBeGreaterThan(-6);
    expect(n).toBeLessThan(52);
    expect(e).toBeLessThan(10);
  });

  it('keeps Russia in one piece across the antimeridian', () => {
    const [[, w], [, e]] = bounds('Russia');
    expect(w).toBeGreaterThan(0);
    expect(e).toBeGreaterThan(180);
  });

  it('rings microstates and atoll nations, but not normal countries', () => {
    const rings = (n: string) => markerPoints([features.get(n)!]).length;
    expect(rings('Vatican')).toBe(1);
    expect(rings('Kiribati')).toBeGreaterThan(2);
    expect(rings('Germany')).toBe(0);
    expect(rings('Indonesia')).toBe(0);
  });
});
