/** Design v2 raster assets (design-v2/assets, @2x of the display size). */

export const IMG = {
  hero: require('@images/advanced-control/hero.png'),
  heroDim: require('@images/advanced-control/hero-dim.png'),
  heroThumb: require('@images/advanced-control/hero-thumb.png'),
  glow: require('@images/advanced-control/stage-glow.png'),
  tintA: require('@images/advanced-control/tint-A.png'),
  tintB: require('@images/advanced-control/tint-B.png'),
  tintHead: require('@images/advanced-control/tint-head.png'),
  tintEgg: require('@images/advanced-control/tint-egg.png'),
};
/** hero.png is 780x368 (@2x) -> 390x184 in image points. */
export const HERO_PT = { w: 390, h: 184 };
/** stage-glow.png is 780x928 (@2x of a 390-wide screen, radial light pools from spec §5). */
export const GLOW_PT = { w: 390, h: 464 };
