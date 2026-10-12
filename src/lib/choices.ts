import type { Country } from '../data/countries';
import { shuffle } from './answers';

type LatLon = [number, number];

/** Great-circle distance in km. Works with longitudes shifted past ±180°. */
export function distanceKm([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Multiple-choice options for `answer`: the answer plus `count - 1` decoys
 * drawn at random from its `nearest` closest countries, so the options are
 * plausible neighbours rather than obvious giveaways. Returned shuffled.
 */
export function pickChoices(
  answer: Country,
  countries: Country[],
  centreOf: (c: Country) => LatLon,
  count = 4,
  nearest = 8,
): Country[] {
  const origin = centreOf(answer);
  const neighbours = countries
    .filter((c) => c !== answer)
    .map((c) => ({ c, d: distanceKm(origin, centreOf(c)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, nearest)
    .map((x) => x.c);
  return shuffle([answer, ...shuffle(neighbours).slice(0, count - 1)]);
}
