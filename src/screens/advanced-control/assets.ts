/**
 * Design v4 soft-blob placeholders (design-v4/assets/blobs, generated in the
 * Control-tile style by tools/make_blobs.py; 360 px, shown at 44 / 60 pt).
 * The App designer may redraw them in the house file (spec §9.5).
 */
export const BLOB = {
  /**
   * WING ICON SWAP POINT (design is redrawing it): the only reference to the
   * wings artwork. Used by the Wings card head (44 pt) and the Control-page
   * entry row (60 pt). Replace assets/images/advanced-control/wings.png
   * (square, transparent, >= 180 px; 360 px today) or point this require at
   * the new file.
   */
  wings: require('@images/advanced-control/wings.png'),
  pulse: require('@images/advanced-control/pulse.png'),
  bullet: require('@images/advanced-control/bullet.png'),
};
