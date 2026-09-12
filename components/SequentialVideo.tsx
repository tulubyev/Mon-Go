import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';

export type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'any';

export type Clip = { id: string; uri: string; gradient: [string, string, string]; season: Season };

const SEASON_GRADIENT: Record<Season, [string, string, string]> = {
  winter: ['#0F2878', '#163F8C', '#0C3A6E'],
  spring: ['#0C3A6E', '#1D6E8C', '#0B4C5C'],
  summer: ['#015197', '#1A5FA0', '#0B2E5C'],
  autumn: ['#1A3A6E', '#8C5A1A', '#7b241c'],
  any: ['#015197', '#0F5080', '#7b241c'],
};

// No hosted Mongolia footage yet — an empty catalog is a valid state (the
// block below just shows its gradient + overlay, no <video> mounted) rather
// than pointing at placeholder URLs that would 404. Once real clips are
// uploaded via /api/welcome-videos they replace this automatically.
export const FALLBACK_CATALOG: Clip[] = [];

/** Ответ `/api/welcome-videos` в клип с готовым градиентом под сезон. */
export function toClip(row: { id: number | string; url: string; season: Season }): Clip {
  return { id: String(row.id), uri: row.url, season: row.season, gradient: SEASON_GRADIENT[row.season] };
}

/** Северное полушарие, метеорологические границы сезонов. */
function currentSeason(date: Date): Exclude<Season, 'any'> {
  const month = date.getMonth(); // 0 = январь
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

const IN_SEASON_LIMIT = 50;

/**
 * Очередь роликов под сезон: сначала ролики текущего сезона (и без сезонной
 * привязки, 'any'), затем понемногу остальных сезонов, чтобы они тоже
 * изредка мелькали. Пусто на входе — пусто на выходе, компонент это
 * обрабатывает без падения.
 */
export function buildSeasonalPlaylist(catalog: Clip[], now: Date = new Date()): Clip[] {
  if (catalog.length === 0) return catalog;
  const season = currentSeason(now);
  const inSeason = catalog.filter((c) => c.season === season || c.season === 'any');
  const others = (['winter', 'spring', 'summer', 'autumn'] as const)
    .filter((s) => s !== season)
    .flatMap((s) => catalog.filter((c) => c.season === s).slice(0, 2));
  const queue = [...inSeason.slice(0, IN_SEASON_LIMIT), ...others];
  return queue.length > 0 ? queue : catalog;
}

interface Props {
  playlist: Clip[];
  startIndex?: number;
}

export default function SequentialVideoBlock({ playlist, startIndex = 0 }: Props) {
  const indexRef = useRef(startIndex % Math.max(playlist.length, 1));
  const current = playlist[indexRef.current % Math.max(playlist.length, 1)];

  const player = useVideoPlayer(current?.uri ?? null, (p) => {
    p.loop = false;
    p.muted = true;
    if (current) p.play();
  });

  useEventListener(player, 'playToEnd', () => {
    if (playlist.length === 0) return;
    indexRef.current = (indexRef.current + 1) % playlist.length;
    const next = playlist[indexRef.current];
    player.replace(next.uri);
    player.play();
  });

  // Playlist swapped out from under us (e.g. server data arrived after the
  // fallback render) — reset to the new list's first clip.
  useEffect(() => {
    if (playlist.length === 0) return;
    indexRef.current = startIndex % playlist.length;
    player.replace(playlist[indexRef.current].uri);
    player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  const gradient = current?.gradient ?? SEASON_GRADIENT.any;

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      {current && (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
      )}
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1,20,60,0.15)',
  },
});
