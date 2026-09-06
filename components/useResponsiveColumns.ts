import { useWindowDimensions } from 'react-native';

/**
 * Column count for a grid, driven by live window width (not Platform.isPad —
 * iPad Split View can present the app as narrow as ~320-414pt, so a device
 * check would be wrong exactly when it matters most).
 */
export function useResponsiveColumns(minItemWidth: number, maxColumns = 4): number {
  const { width } = useWindowDimensions();
  return Math.min(maxColumns, Math.max(2, Math.floor(width / minItemWidth)));
}
