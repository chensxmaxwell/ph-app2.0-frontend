/**
 * Global Auto bar (ICD001-1, PROTOCOL §11.3.7 / §11.4.13 / §11.6.3): the device
 * keeps following the body after the user leaves Manual, so the bottom-tab
 * pages (Home / Control / Chat / Profile) show a slim bar docked on top of the
 * tab bar. It takes layout space: the tab scenes get `paddingBottom:
 * AUTO_BAR_H` while it shows (nav-bar.tsx), so it never covers page content.
 *
 * - `auto`: "Auto on". Tap the bar = open Manual; "Stop all" = `ESTOP 1`, the
 *   same as Stop all on the page (product decision 10/06 23:39). Reply
 *   `OK ESTOP 1` → `EVT MODE MANUAL ESTOP` (§11.4.6).
 * - `stopped`: an e-stop is latched while no control page is open: "Stopped" +
 *   Unlock (`ESTOP 0`; the device stays manual with outputs 0, §11.6.4).
 * Hidden on full-screen stack pages (no tab bar) and while a control page is
 * focused (it has the Auto | Manual control and Stop all).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SCREENS } from '../../../common/constant';
import { colors } from '../../../common/styles/colors';
import { useControlPageFocused, useIcd001 } from '../../../services/icd001';
import { getHomeStackNavigation } from '../../love/overlay';
import { AutoBarState, autoBarState } from '../model';
import { text, v4 } from '../theme';

/** Bar height in pt (excluded from the tab scenes while the bar shows). */
export const AUTO_BAR_H = 40;

export function useAutoBarState(): AutoBarState {
  const { state } = useIcd001();
  const focused = useControlPageFocused();
  return autoBarState(state, focused);
}

export const AutoBar = ({ state, onOpen }: { state: AutoBarState; onOpen?: () => void }) => {
  const { client } = useIcd001();
  if (!state) {
    return null;
  }
  const open =
    onOpen ??
    (() => {
      getHomeStackNavigation()?.navigate(SCREENS.MANUAL as never);
    });
  const auto = state === 'auto';
  return (
    <View style={styles.bar} testID="auto-bar">
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={auto ? 'Auto is on. Open Manual' : 'Everything is stopped. Open Manual'}
        style={styles.body}
        testID="auto-bar-open"
      >
        <View style={[styles.dot, !auto && styles.dotStopped]} />
        <Text style={styles.label}>{auto ? 'Auto on' : 'Stopped'}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          client.setEstop(auto).catch(() => undefined);
        }}
        accessibilityRole="button"
        accessibilityLabel={auto ? 'Stop all' : 'Unlock'}
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        testID={auto ? 'auto-bar-stop' : 'auto-bar-unlock'}
      >
        {auto ? <View style={styles.square} /> : null}
        <Text style={styles.btnText}>{auto ? 'Stop all' : 'Unlock'}</Text>
      </Pressable>
    </View>
  );
};

/**
 * Tab bar host (nav-bar.tsx `tabBar`): absolute at the bottom like the old
 * `position: absolute` tab bar, with the Auto bar stacked on top of it.
 */
export const AutoBarHost = ({ children }: { children: React.ReactNode }) => {
  const state = useAutoBarState();
  return (
    <View style={styles.host} pointerEvents="box-none">
      <AutoBar state={state} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    height: AUTO_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 12,
    // same solid surface as the tab bar it sits on; hairline above, none below
    backgroundColor: colors.grayLightSolid,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: v4.white60,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', height: AUTO_BAR_H },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: v4.green, marginRight: 10 },
  dotStopped: { backgroundColor: v4.red },
  label: text(15, v4.white, 20),
  chevron: { ...text(18, v4.white60, 20), marginLeft: 6 },
  btn: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: v4.white,
  },
  pressed: { opacity: 0.7 },
  square: { width: 10, height: 10, borderRadius: 2, backgroundColor: v4.ink, marginRight: 8 },
  btnText: text(14, v4.ink, 18),
});
