import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import world from 'world-atlas/countries-50m.json';

export type CountryFeature = Feature<Polygon | MultiPolygon, { name: string }>;

type Bounds = [[number, number], [number, number]]; // [[south, west], [north, east]]

/** All world-atlas features, keyed by their Natural Earth name. */
export function loadFeatures(): Map<string, CountryFeature> {
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
  const byName = new Map<string, CountryFeature>();
  for (const f of fc.features) {
    if (f.properties.name === 'Antarctica') continue;
    byName.set(f.properties.name, unwrapAntimeridian(f));
  }
  return byName;
}

function polygons(f: CountryFeature): Position[][][] {
  return f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
}

function ringBounds(rings: Position[][]): Bounds {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lon, lat] of rings[0]) {
    if (lat < s) s = lat;
    if (lat > n) n = lat;
    if (lon < w) w = lon;
    if (lon > e) e = lon;
  }
  return [[s, w], [n, e]];
}

/** Rough planar area of a polygon's outer ring, in square degrees. */
function ringArea(rings: Position[][]): number {
  const r = rings[0];
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  }
  return Math.abs(a / 2);
}

/**
 * Countries that straddle the 180° meridian (Russia, Fiji, the US's Aleutians…)
 * have parts at both ends of the map. Shift the smaller side by 360° so the
 * country draws as one piece.
 */
function unwrapAntimeridian(f: CountryFeature): CountryFeature {
  const polys = polygons(f);
  const nearEast = polys.filter((p) => ringBounds(p)[1][1] > 160);
  const nearWest = polys.filter((p) => ringBounds(p)[0][1] < -160);
  if (!nearEast.length || !nearWest.length) return f;

  const area = (ps: Position[][][]) => ps.reduce((sum, p) => sum + ringArea(p), 0);
  const eastHeavy = area(polys.filter((p) => ringBounds(p)[1][1] > 0)) >= area(polys.filter((p) => ringBounds(p)[1][1] <= 0));

  // Shift per coordinate: some rings (e.g. Russia's mainland) are stitched
  // across the meridian and contain points on both sides.
  const shifted = polys.map((p) =>
    p.map((ring) =>
      ring.map(([lon, lat]) => {
        if (eastHeavy && lon < -90) return [lon + 360, lat];
        if (!eastHeavy && lon > 90) return [lon - 360, lat];
        return [lon, lat];
      }),
    ),
  );
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: shifted } };
}

function union(a: Bounds, b: Bounds): Bounds {
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

function gap(a: Bounds, b: Bounds): number {
  const dLat = Math.max(0, b[0][0] - a[1][0], a[0][0] - b[1][0]);
  const dLon = Math.max(0, b[0][1] - a[1][1], a[0][1] - b[1][1]);
  return Math.hypot(dLat, dLon);
}

/**
 * Bounds to zoom to: the largest landmass plus any parts within ~12° of it,
 * so France frames on Europe rather than stretching to French Guiana, while
 * archipelagos like Indonesia stay whole.
 */
export function focusBounds(features: CountryFeature[]): Bounds {
  const polys = features.flatMap(polygons).sort((a, b) => ringArea(b) - ringArea(a));
  let bounds = ringBounds(polys[0]);
  let remaining = polys.slice(1).map(ringBounds);
  let grew = true;
  while (grew) {
    grew = false;
    const next: Bounds[] = [];
    for (const b of remaining) {
      if (gap(bounds, b) < 12) {
        bounds = union(bounds, b);
        grew = true;
      } else next.push(b);
    }
    remaining = next;
  }
  return bounds;
}

/**
 * For countries with too little land to see at a glance (microstates, atoll
 * nations), the [lat, lon] centres of their island clusters, to ring on the
 * map. Empty for everything else.
 */
export function markerPoints(features: CountryFeature[]): [number, number][] {
  const polys = features.flatMap(polygons);
  if (polys.reduce((sum, p) => sum + ringArea(p), 0) > 0.5) return [];

  const points: [number, number][] = [];
  for (const p of polys) {
    const [[s, w], [n, e]] = ringBounds(p);
    const c: [number, number] = [(s + n) / 2, (w + e) / 2];
    if (!points.some(([lat, lon]) => Math.hypot(lat - c[0], lon - c[1]) < 2)) points.push(c);
  }
  return points;
}

/** [lat, lon] centre of a country's main landmass (see focusBounds). */
export function centre(features: CountryFeature[]): [number, number] {
  const [[s, w], [n, e]] = focusBounds(features);
  return [(s + n) / 2, (w + e) / 2];
}
