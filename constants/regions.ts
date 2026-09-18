import type { LngLatBounds } from '@maplibre/maplibre-react-native';

// Aimags (+ Ulaanbaatar) with the bounding box of their real OSM
// admin_level=4 boundary, from the Geofabrik Mongolia extract (2026-09-18,
// TMB/scripts/osm/extract-poi.py). tiles/sizeMB are measured against
// mongolia.pmtiles for z12–13 (TMB/scripts/osm/region-sizes.mjs) — the exact
// request count and byte size a region pack downloads, not an estimate.
// z14 was dropped: it is 3/4 of the tile requests for the same tracks
// (they enter the tiles at z13), so a big aimag went from ~130k to ~30k.

export interface Region {
  id: string; // ISO 3166-2
  name: { ru: string; en: string; mn: string };
  bbox: LngLatBounds;
  tiles: number;
  sizeMB: number;
}

export const REGIONS: Region[] = [
  { id: 'MN-073', name: { ru: "Архангай", en: "Arkhangai", mn: "Архангай" }, bbox: [98.1734, 46.8235, 103.6777, 49.2049], tiles: 13038, sizeMB: 4.5 },
  { id: 'MN-071', name: { ru: "Баян-Улгий", en: "Bayan-Ölgii", mn: "Баян-Өлгий" }, bbox: [87.7346, 46.5417, 91.9271, 50.0012], tiles: 14304, sizeMB: 5.2 },
  { id: 'MN-069', name: { ru: "Баянхонгор", en: "Bayankhongor", mn: "Баянхонгор" }, bbox: [97.6327, 42.5663, 101.8079, 47.7217], tiles: 20148, sizeMB: 3.3 },
  { id: 'MN-067', name: { ru: "Булган", en: "Bulgan", mn: "Булган" }, bbox: [101.6325, 47.2506, 104.7605, 50.4104], tiles: 9936, sizeMB: 3.2 },
  { id: 'MN-065', name: { ru: "Говь-Алтай", en: "Govi-Altai", mn: "Говь-Алтай" }, bbox: [93.0988, 42.7019, 98.4853, 47.7926], tiles: 25730, sizeMB: 4.2 },
  { id: 'MN-064', name: { ru: "Говь-Сумбэр", en: "Govisumber", mn: "Говьсүмбэр" }, bbox: [107.8839, 45.8807, 109.1198, 47.0001], tiles: 1440, sizeMB: 0.3 },
  { id: 'MN-037', name: { ru: "Дархан-Уул", en: "Darkhan-Uul", mn: "Дархан-Уул" }, bbox: [105.838, 49.1223, 106.8237, 49.9281], tiles: 870, sizeMB: 0.6 },
  { id: 'MN-063', name: { ru: "Дорноговь", en: "Dornogovi", mn: "Дорноговь" }, bbox: [107.6472, 42.3956, 111.9678, 46.624], tiles: 16914, sizeMB: 1.9 },
  { id: 'MN-061', name: { ru: "Дорнод", en: "Dornod", mn: "Дорнод" }, bbox: [111.9961, 46.2887, 119.9322, 50.2827], tiles: 31213, sizeMB: 4.3 },
  { id: 'MN-059', name: { ru: "Дундговь", en: "Dundgovi", mn: "Дундговь" }, bbox: [103.6152, 44.1774, 108.653, 46.7813], tiles: 12513, sizeMB: 1.8 },
  { id: 'MN-057', name: { ru: "Завхан", en: "Zavkhan", mn: "Завхан" }, bbox: [93.1824, 46.5643, 99.2154, 50.0436], tiles: 20700, sizeMB: 4.8 },
  { id: 'MN-035', name: { ru: "Орхон", en: "Orkhon", mn: "Орхон" }, bbox: [103.9564, 48.8976, 104.6325, 49.169], tiles: 214, sizeMB: 0.3 },
  { id: 'MN-051', name: { ru: "Сухэ-Батор", en: "Sükhbaatar", mn: "Сүхбаатар" }, bbox: [111.1671, 44.7424, 116.5776, 47.7939], tiles: 15861, sizeMB: 1.9 },
  { id: 'MN-049', name: { ru: "Сэлэнгэ", en: "Selenge", mn: "Сэлэнгэ" }, bbox: [104.3633, 48.5048, 108.5714, 50.4795], tiles: 8554, sizeMB: 2.7 },
  { id: 'MN-047', name: { ru: "Туве", en: "Töv", mn: "Төв" }, bbox: [104.0686, 46.3805, 109.0388, 49.1253], tiles: 13395, sizeMB: 6.9 },
  { id: 'MN-055', name: { ru: "Уверхангай", en: "Övörkhangai", mn: "Өвөрхангай" }, bbox: [101.1363, 44.0489, 104.6533, 47.4307], tiles: 11368, sizeMB: 2.9 },
  { id: 'MN-046', name: { ru: "Увс", en: "Uvs", mn: "Увс" }, bbox: [90.0023, 48.4243, 95.726, 50.8843], tiles: 14432, sizeMB: 3.4 },
  { id: 'MN-1', name: { ru: "Улан-Батор", en: "Ulaanbaatar", mn: "Улаанбаатар" }, bbox: [106.3626, 47.302, 108.5008, 48.2719], tiles: 2091, sizeMB: 3.7 },
  { id: 'MN-053', name: { ru: "Умнеговь", en: "Ömnögovi", mn: "Өмнөговь" }, bbox: [99.417, 41.58, 108.0337, 45.2022], tiles: 28101, sizeMB: 2.5 },
  { id: 'MN-043', name: { ru: "Ховд", en: "Khovd", mn: "Ховд" }, bbox: [90.6678, 44.9994, 94.3068, 48.9688], tiles: 14053, sizeMB: 3 },
  { id: 'MN-041', name: { ru: "Хувсгел", en: "Hovsgel", mn: "Хөвсгөл" }, bbox: [96.8755, 48.2353, 102.7847, 52.1496], tiles: 23660, sizeMB: 5.3 },
  { id: 'MN-039', name: { ru: "Хэнтий", en: "Khentii", mn: "Хэнтий" }, bbox: [108.3856, 46.0598, 112.6941, 49.3919], tiles: 14186, sizeMB: 4.5 },
];
