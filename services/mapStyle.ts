// Per-locale label language for the vector basemap
// (TMB/public/map-style-vector-<locale>.json).
//
// @maplibre/maplibre-react-native's MapRef (checked directly against
// node_modules — getCenter/getZoom/getBounds/queryRenderedFeatures/
// setSourceVisibility/etc) has no setLayoutProperty/setPaintProperty: that
// runtime style-layer mutation only exists in maplibre-gl-js (web), not in
// this native binding. So there's no way to patch one loaded style's
// text-field in place — locale switching here means swapping which style
// URL the <Map> component's `mapStyle` prop points at, which reloads the
// style (a brief flash, not a live in-place update). TMB generates one
// static style file per locale (scripts/gen-map-styles.js) so this is just a
// URL lookup, not something computed on-device.
//
// All 4 style variants share the exact same tile source
// (/tiles/mongolia/{z}/{x}/{y}.pbf), so an offline pack downloaded under any
// one locale's style still covers every locale — OfflineManager caches by
// the tile URLs it fetched, not by which style JSON requested them.

export type MapLocale = 'ru' | 'en' | 'zh' | 'mn';

const SUPPORTED: readonly MapLocale[] = ['ru', 'en', 'zh', 'mn'];

export function mapStyleUrlForLocale(locale: string): string {
  const l = (SUPPORTED as readonly string[]).includes(locale) ? (locale as MapLocale) : 'ru';
  return `https://mon-go.ru/map-style-vector-${l}.json`;
}
