import type { Country } from '../data/countries';

/** Lowercase, strip accents/punctuation, and unify common abbreviations. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bst\.?(?=\s)/g, 'saint')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

function acceptedForms(country: Country): string[] {
  return [country.name, ...(country.aliases ?? [])].map(normalize);
}

export function isCorrect(input: string, country: Country): boolean {
  const n = normalize(input);
  return n.length > 0 && acceptedForms(country).includes(n);
}

export interface Suggestion {
  country: Country;
  /** The alias that matched, if the match wasn't on the canonical name. */
  via?: string;
}

/**
 * Countries whose name or alias matches the input. Prefix matches on any word
 * rank above substring matches; canonical names rank above aliases.
 */
export function suggest(input: string, countries: Country[], limit = 8): Suggestion[] {
  const q = normalize(input);
  if (!q) return [];

  const scored: (Suggestion & { score: number })[] = [];
  for (const country of countries) {
    const forms = [country.name, ...(country.aliases ?? [])];
    let best: (Suggestion & { score: number }) | undefined;
    for (let i = 0; i < forms.length; i++) {
      const n = normalize(forms[i]);
      let score: number;
      if (n.startsWith(q)) score = 0;
      else if (n.split(' ').some((w) => w.startsWith(q))) score = 1;
      else if (n.includes(q)) score = 2;
      else continue;
      if (i > 0) score += 0.5;
      if (!best || score < best.score) best = { country, via: i > 0 ? forms[i] : undefined, score };
    }
    if (best) scored.push(best);
  }

  scored.sort((a, b) => a.score - b.score || a.country.name.localeCompare(b.country.name));
  return scored.slice(0, limit).map(({ country, via }) => ({ country, via }));
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
