/**
 * Design v4 artwork. Pulse / Bullet are soft-blob placeholders
 * (design-v4/assets/blobs, Control-tile style; 360 px, shown at 44 / 32 pt).
 *
 * WING ICON SWAP POINT: the only references to the wings artwork. Design's
 * redraw (design-v4/assets/icon-wings, 2026-10-04) ships one PNG set per size,
 * named for RN scale selection (Metro picks @2x / @3x by screen density):
 *   - wingsCard  -> assets/images/advanced-control/wings-card{,@2x,@3x}.png
 *                   (= icon-wings@2x / @3x.png; 44 pt, Wings card head)
 *   - wingsEntry -> assets/images/advanced-control/wings-entry{,@2x,@3x}.png
 *                   (= icon-wings-entry@2x / @3x.png; 60 pt, Control-page entry row)
 * The 1x files are LANCZOS downscales of @3x (44 / 60 px). The blurred
 * icon-wings.svg is deliberately not used (RN has no SVG blur filters).
 */
export const BLOB = {
  wingsCard: require('@images/advanced-control/wings-card.png'),
  wingsEntry: require('@images/advanced-control/wings-entry.png'),
  pulse: require('@images/advanced-control/pulse.png'),
  bullet: require('@images/advanced-control/bullet.png'),
};
