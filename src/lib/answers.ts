/** Something the user can name: a country, a capital… */
export interface Answerable {
  name: string;
  aliases?: string[];
}

/** Lowercase, strip accents/punctuation, and unify common abbreviations. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019\u02bb]/g, '') // apostrophes, incl. curly and ʻokina
    .replace(/&/g, ' and ')
    .replace(/\bst\.?(?=\s)/g, 'saint')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

function acceptedForms(item: Answerable): string[] {
  return [item.name, ...(item.aliases ?? [])].map(normalize);
}

export function isCorrect(input: string, item: Answerable): boolean {
  const n = normalize(input);
  return n.length > 0 && acceptedForms(item).includes(n);
}

export interface Suggestion<T extends Answerable = Answerable> {
  item: T;
  /** The alias that matched, if the match wasn't on the canonical name. */
  via?: string;
}

/**
 * Items whose name or alias matches the input. Prefix matches on any word
 * rank above substring matches; canonical names rank above aliases.
 */
export function suggest<T extends Answerable>(input: string, items: T[], limit = 8): Suggestion<T>[] {
  const q = normalize(input);
  if (!q) return [];

  const scored: (Suggestion<T> & { score: number })[] = [];
  for (const item of items) {
    const forms = [item.name, ...(item.aliases ?? [])];
    let best: (Suggestion<T> & { score: number }) | undefined;
    for (let i = 0; i < forms.length; i++) {
      const n = normalize(forms[i]);
      let score: number;
      if (n.startsWith(q)) score = 0;
      else if (n.split(' ').some((w) => w.startsWith(q))) score = 1;
      else if (n.includes(q)) score = 2;
      else continue;
      if (i > 0) score += 0.5;
      if (!best || score < best.score) best = { item, via: i > 0 ? forms[i] : undefined, score };
    }
    if (best) scored.push(best);
  }

  scored.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map(({ item, via }) => ({ item, via }));
}

/** A shuffled copy. Pass a seeded `rng` (see random.ts) for a repeatable order. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
