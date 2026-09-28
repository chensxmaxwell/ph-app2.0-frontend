/** Reduced-motion flag shared by the stage and row animations (spec §7). */
import { AccessibilityInfo } from 'react-native';

let reduce = false;

try {
  Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
    .then(v => {
      reduce = v === true;
    })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => {
    reduce = v;
  });
} catch {
  // Test/web environments without AccessibilityInfo: keep motion on.
}

export const reduceMotion = (): boolean => reduce;
