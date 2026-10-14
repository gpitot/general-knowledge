import { describe, expect, it } from 'vitest';
import { COUNTRIES, type Country } from '../data/countries';
import { centre, loadFeatures } from './geo';
import { DAILY_LENGTH, dailyNumber, dailyQuiz, localDate, shareText } from './daily';
import { seededRng } from './random';

const features = loadFeatures();
const centreOf = (c: Country) => centre([c.atlas ?? c.name, ...(c.includes ?? [])].map((n) => features.get(n)!));

/** A quiz reduced to plain data, for comparing. */
const summary = (date: string) =>
  dailyQuiz(date, centreOf).map((q) => [q.kind, q.country.name, q.choices.map((c) => c.name)]);

describe('seeded random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRng('x');
    const b = seededRng('x');
    const c = seededRng('y');
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('daily quiz', () => {
  it('is the same every time for a given date', () => {
    expect(summary('2026-10-14')).toEqual(summary('2026-10-14'));
  });

  it('differs from day to day', () => {
    expect(summary('2026-10-15')).not.toEqual(summary('2026-10-14'));
  });

  it('has 10 different countries, a mix of question kinds, and four options including the answer', () => {
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2027, 0, 1 + day)).toISOString().slice(0, 10);
      const quiz = dailyQuiz(date, centreOf);
      expect(quiz).toHaveLength(DAILY_LENGTH);
      expect(new Set(quiz.map((q) => q.country)).size).toBe(DAILY_LENGTH);
      expect(new Set(quiz.map((q) => q.kind))).toEqual(new Set(['map', 'flag', 'capital', 'capital-of']));
      for (const q of quiz) {
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices).toContain(q.country);
        expect(q.choices.every((c) => COUNTRIES.includes(c))).toBe(true);
      }
    }
  });

  // Everyone playing on a date must get the same quiz, including people who
  // loaded the site before a deploy and people who loaded it after. If this
  // fails, the generator (or the country list) changed: that's fine between
  // days, but it reshuffles every past and future quiz, so do it knowingly.
  it('keeps the quiz for a known date stable', () => {
    expect(summary('2026-10-14').map(([kind, name]) => `${kind}:${name}`)).toMatchInlineSnapshot(`
      [
        "capital:Micronesia",
        "map:Moldova",
        "map:Gabon",
        "capital-of:Bolivia",
        "flag:Eswatini",
        "flag:Russia",
        "capital:Uzbekistan",
        "map:Estonia",
        "flag:Ghana",
        "capital-of:Canada",
      ]
    `);
  });

  it('numbers quizzes from the first day', () => {
    expect(dailyNumber('2026-10-14')).toBe(1);
    expect(dailyNumber('2026-10-15')).toBe(2);
    expect(dailyNumber('2027-10-14')).toBe(366);
  });

  it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('shares the score without the answers', () => {
    expect(shareText('2026-10-15', [true, false, true], 'https://example.com/')).toBe(
      'Geography Quiz daily #2: 2/3\n🟩🟥🟩\nhttps://example.com/',
    );
  });
});
