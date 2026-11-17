import type { Country } from '../data/countries';
import { shuffle } from './answers';
import type { QuestionKind } from './daily';

/**
 * Training mode: practice quizzes are biased towards questions the user has
 * gotten wrong recently. Every answer (practice and daily) updates a small
 * score for its (kind, country) pair, kept in the browser only.
 *
 * Scores are exponential moving averages: each new answer for a question
 * shrinks both of its counts by DECAY and adds 1 to the appropriate one. So
 * recent answers weigh more than old ones, and answering correctly
 * repeatedly "unsticks" a question. `capital-of` questions from the daily
 * quiz are recorded under `capital`, as they test the same knowledge.
 */

export interface QuestionScore {
  /** Weighted count of wrong answers. */
  w: number;
  /** Weighted count of correct answers. */
  r: number;
}

export type TrainingStats = Record<string, QuestionScore>;

/** How fast old answers fade: each new answer multiplies both counts by this. */
const DECAY = 0.7;

/** The share of a training quiz drawn from questions the user gets wrong. */
export const HARD_FRACTION = 0.7;

export function statsKey(kind: QuestionKind, name: string): string {
  return `${kind === 'capital-of' ? 'capital' : kind}:${name}`;
}

/** Register one answer: wrong answers raise the score, correct ones lower it. */
export function recordAnswer(
  stats: TrainingStats,
  kind: QuestionKind,
  name: string,
  correct: boolean,
): TrainingStats {
  const key = statsKey(kind, name);
  const { w, r } = stats[key] ?? { w: 0, r: 0 };
  const next = { w: w * DECAY, r: r * DECAY };
  if (correct) next.r += 1;
  else next.w += 1;
  return { ...stats, [key]: next };
}

/** How difficult the user finds a question: positive means "gets it wrong". */
export function difficulty(stats: TrainingStats, kind: QuestionKind, name: string): number {
  const s = stats[statsKey(kind, name)];
  return s ? s.w - s.r : 0;
}

/** The pool's questions the user finds hard, most difficult first. */
export function hardCountries(pool: Country[], kind: QuestionKind, stats: TrainingStats): Country[] {
  return pool
    .filter((c) => difficulty(stats, kind, c.name) > 0)
    .sort((a, b) => difficulty(stats, kind, b.name) - difficulty(stats, kind, a.name));
}

/** Pick `count` items without replacement, weighting each by `weight`. */
export function weightedSample<T>(
  items: T[],
  weight: (item: T) => number,
  count: number,
  rng: () => number = Math.random,
): T[] {
  const remaining = [...items];
  const picked: T[] = [];
  while (picked.length < count && remaining.length > 0) {
    let total = 0;
    for (const item of remaining) total += Math.max(weight(item), 0);
    const i = Math.floor(rng() * (total > 0 ? total : remaining.length));
    let acc = 0;
    let pick = 0;
    for (; pick < remaining.length; pick++) {
      acc += total > 0 ? Math.max(weight(remaining[pick]), 0) : 1;
      if (i < acc) break;
    }
    picked.push(remaining.splice(pick, 1)[0]);
  }
  return picked;
}

/**
 * The countries for a training quiz: up to HARD_FRACTION come from the
 * questions the user gets wrong, weighted towards the hardest and with no
 * repeats; the rest are picked uniformly from the remaining pool. Hard ones
 * come first so they're met while fresh. With no history, this is plain
 * random — every country still has a chance.
 */
export function trainingCountries(
  pool: Country[],
  count: number,
  kind: QuestionKind,
  stats: TrainingStats,
  rng: () => number = Math.random,
): Country[] {
  const hard = hardCountries(pool, kind, stats);
  const hardCount = Math.min(Math.round(count * HARD_FRACTION), hard.length);
  const picked = weightedSample(hard, (c) => difficulty(stats, kind, c.name), hardCount, rng);
  const rest = shuffle(
    pool.filter((c) => !picked.includes(c)),
    rng,
  ).slice(0, count - hardCount);
  return [...picked, ...rest];
}

// Stats and the mode toggle are kept in the browser only.
const STATS_KEY = 'gk-training';
const MODE_KEY = 'gk-training-mode';

function isScore(value: unknown): value is QuestionScore {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QuestionScore).w === 'number' &&
    Number.isFinite((value as QuestionScore).w) &&
    typeof (value as QuestionScore).r === 'number' &&
    Number.isFinite((value as QuestionScore).r)
  );
}

export function loadTrainingStats(): TrainingStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const clean: TrainingStats = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isScore(value)) clean[key] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveTrainingStats(stats: TrainingStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Storage unavailable (private mode, blocked cookies): stats are session-only.
  }
}

export function loadTrainingMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveTrainingMode(on: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable: the toggle just isn't remembered.
  }
}
