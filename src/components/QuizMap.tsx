import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { focusBounds, markerPoints, type CountryFeature } from '../lib/geo';

export type MapStatus = 'asking' | 'correct' | 'wrong';

interface Props {
  allFeatures: CountryFeature[];
  target: CountryFeature[];
  status: MapStatus;
}

const HIGHLIGHT: Record<MapStatus, string> = {
  asking: '#e4572e',
  correct: '#2a9d5c',
  wrong: '#c62f3a',
};

/**
 * Leaflet normally clips shapes to the visible area. Turning that off (plus
 * `overflow: visible` on the SVG in styles.css) keeps every country drawn.
 */
const WHOLE_WORLD = { noClip: true } as L.PathOptions;

/** Fly to the country, one zoom level wider than a tight fit so neighbours give context. */
function frame(map: L.Map, bounds: L.LatLngBoundsLiteral, duration: number) {
  const b = L.latLngBounds(bounds);
  const zoom = Math.min(map.getBoundsZoom(b, false, L.point(40, 40)) - 1, 5);
  map.flyTo(b.getCenter(), Math.max(zoom, 1), { duration });
}

export default function QuizMap({ allFeatures, target, status }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const highlightRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<L.LatLngBoundsLiteral | null>(null);
  const shownRef = useRef<CountryFeature[] | null>(null);

  // Create the map once, with every country drawn as a neutral base layer.
  // No tile layer: tiles carry place-name labels that would give answers away.
  useEffect(() => {
    const map = L.map(containerRef.current!, {
      // SVG, unclipped (see WHOLE_WORLD): the entire world is drawn at each
      // zoom level, so panning never shows blank areas waiting to redraw.
      renderer: L.svg({ padding: 0.5 }),
      minZoom: 1,
      maxZoom: 10,
      zoomSnap: 0.25,
      worldCopyJump: false,
      maxBounds: [[-80, -250], [88, 250]],
      maxBoundsViscosity: 0.8,
      attributionControl: false,
    });
    L.geoJSON({ type: 'FeatureCollection', features: allFeatures } as GeoJSON.FeatureCollection, {
      style: { ...WHOLE_WORLD, color: '#8f8a7d', weight: 0.6, fillColor: '#ebe6d6', fillOpacity: 1 },
      interactive: false,
    }).addTo(map);
    highlightRef.current = L.layerGroup().addTo(map);

    const Recenter = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create('button', 'map-recenter');
        btn.type = 'button';
        btn.title = 'Zoom back to the country';
        btn.setAttribute('aria-label', 'Zoom back to the country');
        btn.textContent = '⌖';
        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', () => {
          if (boundsRef.current) frame(map, boundsRef.current, 0.6);
        });
        return btn;
      },
    });
    new Recenter({ position: 'topleft' }).addTo(map);

    L.control.attribution({ prefix: false }).addAttribution('Map data: Natural Earth').addTo(map);
    map.setView([20, 0], 2);
    mapRef.current = map;

    // The container can resize (e.g. mobile keyboard); keep Leaflet in sync.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current!);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      shownRef.current = null;
    };
  }, [allFeatures]);

  // Draw and zoom to the target country whenever the question changes. An
  // empty target shows the whole world with nothing highlighted.
  useEffect(() => {
    const map = mapRef.current;
    const group = highlightRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const isNew = target !== shownRef.current;
    shownRef.current = target;
    if (target.length === 0) {
      boundsRef.current = null;
      if (isNew) map.flyTo([20, 0], 2, { duration: 0.8 });
      return;
    }

    const color = HIGHLIGHT[status];
    L.geoJSON({ type: 'FeatureCollection', features: target } as GeoJSON.FeatureCollection, {
      style: { ...WHOLE_WORLD, color, weight: 1.5, fillColor: color, fillOpacity: 0.75 },
      interactive: false,
    }).addTo(group);

    for (const point of markerPoints(target)) {
      L.circleMarker(point, { radius: 16, color, weight: 3, fill: false, interactive: false }).addTo(group);
    }
    const b = focusBounds(target);
    boundsRef.current = b;
    // Only re-frame on a new target, not when the colour changes after answering.
    if (isNew) frame(map, b, 0.8);
  }, [target, status]);

  return <div ref={containerRef} className="quiz-map" role="img" aria-label="Map with one country highlighted" />;
}
