/**
 * iPad-readiness tokens. The app was designed phone-only; these exist to cap
 * width on wide screens (iPad full-screen, ~1024-1366pt) without a full
 * tablet redesign. Split View can still present the app as narrow as
 * ~320-414pt even on iPad — nothing here assumes a minimum width.
 */

/** Comfortable line-length cap for scrollable reading content (articles, lists). */
export const MAX_CONTENT_WIDTH = 600;

/** Cap for floating panels (e.g. the map's InfoCard bottom sheet). */
export const MAX_CARD_WIDTH = 420;

/**
 * Minimum tile width used to derive the home-grid column count.
 * 125 keeps the existing 3-column phone layout unchanged (floor(375/125)=3
 * on a standard iPhone width) while scaling up to 5-6 columns on iPad.
 */
export const GRID_MIN_CARD_WIDTH = 125;

/**
 * Spread into a StyleSheet.create() entry for a screen's scrollable content
 * wrapper — NOT the outer background/SafeAreaView, which should stay full
 * width so its background color still fills the screen.
 */
export const readingContainerStyle = {
  width: '100%' as const,
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: 'center' as const,
};
