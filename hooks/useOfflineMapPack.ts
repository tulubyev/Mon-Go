import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

// Style JSON hosted on the TMB server — OfflineManager.createPack needs a
// real fetchable URL (the native SDK resolves it itself via NSURL/Android's
// style loader), not the inline JS style object the live map otherwise uses.
// Its raster source already points at our /ru-tiles/ proxy (custom
// User-Agent, per OSM's tile usage policy), so offline downloads go through
// the same compliant path as normal browsing.
export const MAP_STYLE_URL = 'https://mon-go.ru/map-style.json';

const PACK_NAME = 'mongolia-overview';

// Whole-country bounding box, generous margin. Zoom capped at 10 (roads +
// towns visible, not building-level) to keep the tile count sane — this is
// a country-wide overview pack, not a street-navigation download.
const MONGOLIA_BOUNDS: LngLatBounds = [87.5, 41.0, 120.0, 52.5];
const MIN_ZOOM = 4;
const MAX_ZOOM = 10;
const TILE_COUNT_LIMIT = 6000;

export type OfflineMapStatus = 'checking' | 'none' | 'downloading' | 'complete' | 'error';

interface OfflineMapPackState {
  status: OfflineMapStatus;
  /** 0-100, only meaningful while status === 'downloading'. */
  progress: number;
  completedTiles: number;
  requiredTiles: number;
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

  return { status, progress, completedTiles, requiredTiles, download, remove };
}
