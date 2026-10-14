import { COUNTRIES, type Country } from '../data/countries';
import { shuffle } from './answers';
import { pickChoices } from './choices';
import { seededRng } from './random';

/**
 * Kinds of question. The first three are the practice games; `capital-of`
 * ("Ouagadougou is the capital of…?") only appears in the daily quiz.
 */
export type QuestionKind = 'map' | 'flag' | 'capital' | 'capital-of';

export interface DailyQuestion {
  country: Country;
  kind: QuestionKind;
  /** Four countries including the answer; show each one's name or capital per `kind`. */
  choices: Country[];
}

export const DAILY_LENGTH = 10;

/** Every day gets this mix of questions, in a shuffled order. */
const MIX: QuestionKind[] = ['map', 'map', 'map', 'flag', 'flag', 'flag', 'capital', 'capital', 'capital-of', 'capital-of'];

/** The date of daily quiz #1. */
const FIRST_DAILY = '2026-10-14';

/** A date in the user's own time zone as YYYY-MM-DD, so the quiz changes at their midnight. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The quiz's number, counting from 1 on the first day. */
export function dailyNumber(date: string): number {
  return dayIndex(date) - dayIndex(FIRST_DAILY) + 1;
}

/**
 * The quiz for a date. It's generated from a seed made from the date alone,
 * so everyone playing on the same date gets the same questions and options
 * in the same order, with no server involved.
 */
export function dailyQuiz(date: string, centreOf: (c: Country) => [number, number]): DailyQuestion[] {
  const rng = seededRng(`daily:${date}`);
  const countries = shuffle(COUNTRIES, rng).slice(0, DAILY_LENGTH);
  const kinds = shuffle(MIX, rng);
  return countries.map((country, i) => ({
    country,
    kind: kinds[i],
    choices: pickChoices(country, COUNTRIES, centreOf, { rng }),
  }));
}

// Results are kept in the browser only, one entry per date: true for each
// question answered correctly.
const storageKey = (date: string) => `gk-daily:${date}`;

export function loadDailyResult(date: string): boolean[] | null {
  try {
    const raw = localStorage.getItem(storageKey(date));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'boolean') ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDailyResult(date: string, results: boolean[]): void {
  try {
    localStorage.setItem(storageKey(date), JSON.stringify(results));
  } catch {
    // Storage unavailable (private mode, blocked cookies): the result just isn't remembered.
  }
}

/** A spoiler-free summary to paste into a chat: score plus one square per question. */
export function shareText(date: string, results: boolean[], url: string): string {
  const score = results.filter(Boolean).length;
  const squares = results.map((r) => (r ? '🟩' : '🟥')).join('');
  return `Geography Quiz daily #${dailyNumber(date)}: ${score}/${results.length}\n${squares}\n${url}`;
}
