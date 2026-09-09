import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

// Style JSON hosted on the TMB server — OfflineManager.createPack needs a
// real fetchable URL (the native SDK resolves it itself via NSURL/Android's
// style loader), not the inline JS style object the live map otherwise uses.
//
// Vector (OpenMapTiles schema), not raster — this is what makes per-locale
// label switching possible at all (see services/mapStyle.ts). Its source
// points at TMB's own /tiles/mongolia/{z}/{x}/{y}.pbf, which splits
// individual tiles out of a single self-hosted mongolia.pmtiles archive
// (see TMB/vector-tile-routes.js) — MapLibre Native (the iOS/Android core
// behind @maplibre/maplibre-react-native) has no pmtiles:// protocol support
// of its own, that's a maplibre-gl-js/web-only feature, so the backend hands
// it normal tile URLs instead. OfflineManager itself is unchanged from the
// old raster setup: it downloads whatever tiles the given style points at,
// vector or raster, with no client-side rework needed.
//
// The pack is created against the ru-locale style specifically, but that's
// only to have ONE concrete URL to hand OfflineManager — all 4 per-locale
// style variants (see services/mapStyle.ts) share this exact tile source, so
// the downloaded pack covers every locale, not just ru.
export const MAP_STYLE_URL = 'https://mon-go.ru/map-style-vector-ru.json';

const PACK_NAME = 'mongolia-overview-v2'; // v2: vector tiles, not the old raster pack

// Whole-country bounding box, generous margin. Zoom capped at 10 for the bulk
// OFFLINE download (roads + towns, not building-level) — the live map when
// online can still show detail up to the source's full z14, this cap only
// limits how many individual tiles OfflineManager has to fetch one-by-one
// for the bundled pack. Unchanged from the old raster pack's tuning; a
// vector tile at this zoom range is typically smaller than its raster
// equivalent anyway (near-empty steppe encodes to very little geometry).
const MONGOLIA_BOUNDS: LngLatBounds = [87.5, 41.0, 120.0, 52.5];
const MIN_ZOOM = 4;
const MAX_ZOOM = 10;
const TILE_COUNT_LIMIT = 6000;

// OfflineManager reports tile counts, not bytes, for either raster or vector
// packs — there's no real byte total to read from the SDK. This average
// (from Planetiler's own build log for mongolia.pmtiles) turns that count
// into an approximate, clearly-labeled MB figure for the progress UI instead
// of a bare tile counter.
const AVG_TILE_KB = 20; // gzip-equivalent average; see TMB/public/tiles/README.md
const estimateMB = (tiles: number) => Math.round((tiles * AVG_TILE_KB) / 1024 * 10) / 10;

export type OfflineMapStatus = 'checking' | 'none' | 'downloading' | 'complete' | 'error';

interface OfflineMapPackState {
  status: OfflineMapStatus;
  /** 0-100, only meaningful while status === 'downloading'. */
  progress: number;
  completedTiles: number;
  requiredTiles: number;
  /** Approximate, not exact — see AVG_TILE_KB comment above. */
  estimatedMB: number;
  download: () => Promise<void>;
  remove: () => Promise<void>;
}

/**
 * Downloads (or reuses) a single country-wide offline map pack via MapLibre's
 * native OfflineManager. Only usable on iOS/Android — web has no MapLibre
 * native module, callers should gate this behind Platform.OS !== 'web'.
 */
export function useOfflineMapPack(): OfflineMapPackState {
  const [status, setStatus] = useState<OfflineMapStatus>('checking');
  const [progress, setProgress] = useState(0);
  const [completedTiles, setCompletedTiles] = useState(0);
  const [requiredTiles, setRequiredTiles] = useState(0);
  const packIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const { OfflineManager } = require('@maplibre/maplibre-react-native');
    OfflineManager.setTileCountLimit(TILE_COUNT_LIMIT);

    let cancelled = false;
    OfflineManager.getPacks().then((packs: any[]) => {
      if (cancelled) return;
      const existing = packs.find(p => p.metadata?.name === PACK_NAME);
      if (existing) {
        packIdRef.current = existing.id;
        setStatus('complete');
      } else {
        setStatus('none');
      }
    }).catch(() => setStatus('none'));

    return () => { cancelled = true; };
  }, []);

  const download = useCallback(async () => {
    if (Platform.OS === 'web' || status === 'downloading') return;
    const { OfflineManager } = require('@maplibre/maplibre-react-native');
    setStatus('downloading');
    setProgress(0);

    try {
      const pack = await OfflineManager.createPack(
        {
          mapStyle: MAP_STYLE_URL,
          bounds: MONGOLIA_BOUNDS,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          metadata: { name: PACK_NAME },
        },
        (_pack: any, packStatus: any) => {
          // percentage is 0-100 already; completedResourceCount/requiredResourceCount
          // give a tile-count fallback for a progress bar that starts at 0/0.
          setProgress(Math.round(packStatus.percentage ?? 0));
          setCompletedTiles(packStatus.completedResourceCount ?? 0);
          setRequiredTiles(packStatus.requiredResourceCount ?? 0);
          if (packStatus.state === 'complete') {
            setStatus('complete');
          }
        },
        () => setStatus('error'),
      );
      packIdRef.current = pack.id;
    } catch {
      setStatus('error');
    }
  }, [status]);

  const remove = useCallback(async () => {
    if (Platform.OS === 'web' || !packIdRef.current) return;
    const { OfflineManager } = require('@maplibre/maplibre-react-native');
    try {
      await OfflineManager.deletePack(packIdRef.current);
    } catch {
      // pack already gone — fall through to resetting local state anyway
    }
    packIdRef.current = null;
    setStatus('none');
    setProgress(0);
  }, []);

  return { status, progress, completedTiles, requiredTiles, estimatedMB: estimateMB(completedTiles), download, remove };
}
