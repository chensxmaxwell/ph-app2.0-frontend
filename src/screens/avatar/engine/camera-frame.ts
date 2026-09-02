/** Framing helpers for the BoZo 捏人 WebView. Keep in sync with viewer-page.html. */

export const FULL_FOV = 26;
export const FULL_COVER = 1.18;
export const MIN_STANDING_HEIGHT = 1.2;
export const FALLBACK_STANDING_HEIGHT = 1.75;

export type BoxSize = { x: number; y: number; z: number };

export type StandingCameraPose = {
  fov: number;
  x: number;
  y: number;
  z: number;
  lookAtY: number;
};

export const cameraDistance = (coverHeight: number, fov: number) => {
  const half = ((fov * Math.PI) / 180) * 0.5;
  return (coverHeight * 0.5) / Math.tan(half);
};

/**
 * Bind-pose * armature matrixWorld lays BoZo on its side at centimeter
 * scale (Y is thickness ~0.003). Prefer a real standing Y, else the
 * longest axis, else a human-height fallback.
 */
export const usableStandingHeight = (size: BoxSize) => {
  if (size.y >= MIN_STANDING_HEIGHT) {
    return size.y;
  }
  const longest = Math.max(size.x, size.y, size.z);
  if (longest >= MIN_STANDING_HEIGHT) {
    return longest;
  }
  return FALLBACK_STANDING_HEIGHT;
};

export const standingCameraPose = (height: number): StandingCameraPose => {
  const h = Math.max(MIN_STANDING_HEIGHT, height);
  const fov = FULL_FOV;
  return {
    fov,
    x: h * 0.06,
    y: h * 0.5,
    z: cameraDistance(h * FULL_COVER, fov),
    lookAtY: h * 0.5,
  };
};

export const verticalCoverage = (pose: StandingCameraPose) => {
  const halfFov = ((pose.fov * Math.PI) / 180) * 0.5;
  return 2 * pose.z * Math.tan(halfFov);
};

export const prefixIndex = (name: string, prefix: string) => {
  if (!name || name.indexOf(prefix) !== 0) {
    return -1;
  }
  const parsed = parseInt(name.slice(prefix.length), 10);
  return Number.isNaN(parsed) ? -1 : parsed;
};
