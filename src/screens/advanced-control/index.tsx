/**
 * 高级控制 (Advanced control), design v2 "Nocturne" (design-v2/spec.md).
 * Rendering only: state, priorities, command mapping and auto-STOP live in
 * useAdvancedControl / controller.ts / model.ts.
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import Gradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GLOW_PT, IMG } from './assets';
import { DeviceLine } from './components/DeviceLine';
import { FineTuneSheet } from './components/FineTuneSheet';
import { ModuleRow } from './components/ModuleRow';
import { Notice } from './components/Notice';
import { Stage } from './components/Stage';
import { StopDock } from './components/StopDock';
import { BulletBody, PulseBody, WingsBody } from './components/bodies';
import { Icon } from './icons';
import { reduceMotion } from './motion';
import { nocturne as N, qs, text } from './theme';
import { useAdvancedControl } from './useAdvancedControl';

import type { CardId, CardView, IntensityView, StagePart } from './controller';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND = LayoutAnimation.create(200, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

export type AdvancedControlParams = { expanded?: CardId } | undefined;

export const AdvancedControlScreen = () => {
  const { view, ctl } = useAdvancedControl();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [fineTune, setFineTune] = useState(false);

  // Deep link / QA harness: open a row on arrival.
  const initial = (route.params as AdvancedControlParams)?.expanded;
  const opened = useRef(false);
  useEffect(() => {
    if (initial && !opened.current && view.cards.some(c => c.card.id === initial)) {
      opened.current = true;
      ctl.toggleCard(initial);
    }
  }, [ctl, initial, view.cards]);

  const toggle = useCallback(
    (id: CardId) => {
      if (!reduceMotion()) {
        LayoutAnimation.configureNext(EXPAND);
      }
      ctl.toggleCard(id);
    },
    [ctl],
  );
  const select = useCallback(
    (p: StagePart) => {
      if (!reduceMotion()) {
        LayoutAnimation.configureNext(EXPAND);
      }
      ctl.selectPart(p);
    },
    [ctl],
  );

  const { screen, banner, device, stage } = view;
  const live = screen.kind !== 'disconnected';
  const rows: CardView[] = live ? view.cards : view.lastSeen;
  const wing = view.cards.find((c): c is IntensityView => c.kind === 'intensity');
  const stopBottom = Math.max(insets.bottom + 4, 16);
  const showLeave = live && screen.kind === 'normal' && view.expanded === null;

  const renderRow = (c: CardView) => {
    const dimmed = !live || (c.kind !== 'sensor' && !c.enabled);
    const common = {
      key: c.card.id,
      testID: `row-${c.card.id}`,
      title: c.card.label,
      subtitle: c.card.subtitle,
      value: c.row,
      expanded: c.expanded,
      dimmed,
      onToggle: live ? () => toggle(c.card.id) : undefined,
    };
    switch (c.kind) {
      case 'intensity':
        return (
          <ModuleRow {...common}>
            <WingsBody v={c} ctl={ctl} onFineTune={() => setFineTune(true)} />
          </ModuleRow>
        );
      case 'rhythm':
        return (
          <ModuleRow {...common}>
            <PulseBody v={c} ctl={ctl} />
          </ModuleRow>
        );
      case 'sensor':
        return (
          <ModuleRow {...common}>
            <BulletBody v={c} />
          </ModuleRow>
        );
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Gradient
        colors={[N.bgTop, N.bg, N.bgBottom]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.glowWrap} pointerEvents="none">
        <Image source={IMG.glow} style={{ width, height: (width * GLOW_PT.h) / GLOW_PT.w }} />
      </View>
      <View style={[styles.nav, { marginTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          hitSlop={4}
        >
          <Icon name="caret-left" size={24} color={N.ink} />
        </Pressable>
        <Text style={styles.h1} accessibilityRole="header">
          Advanced control
        </Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: stopBottom + 112 }}
        showsVerticalScrollIndicator={false}
      >
        <Stage stage={stage} width={width} onSelect={select} />
        <DeviceLine device={device} connecting={view.scan.connecting} />
        {banner ? (
          <Notice
            model={banner}
            busy={view.scan.connecting}
            onAction={a => (a === 'reconnect' ? ctl.reconnect() : ctl.scan())}
          />
        ) : null}
        {view.toast ? (
          <Notice model={{ tone: 'neutral', icon: 'info', title: view.toast, lines: [] }} />
        ) : null}
        <View style={styles.mods}>{rows.map(renderRow)}</View>
      </ScrollView>
      <StopDock
        engaged={view.estop.on}
        bottom={stopBottom}
        onStop={() => ctl.stopAll()}
        onRelease={() => ctl.release()}
      />
      {/* Above the dock scrim, like the design (.leave z-index 4). */}
      {showLeave ? (
        <View style={[styles.leaveWrap, { bottom: stopBottom + 74 }]} pointerEvents="none">
          <Text style={styles.leave}>Leaving this page stops all outputs.</Text>
        </View>
      ) : null}
      {wing ? (
        <FineTuneSheet
          visible={fineTune && wing.enabled}
          freq={wing.freq}
          range={wing.card.freq}
          def={wing.card.freq.def}
          bottom={insets.bottom}
          onChange={hz => ctl.setWingFreq(hz)}
          onClose={() => setFineTune(false)}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.bg },
  glowWrap: { position: 'absolute', top: 0, left: 0 },
  nav: { height: 48, alignItems: 'center', justifyContent: 'center' },
  back: {
    position: 'absolute',
    left: 8,
    top: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { ...text(qs.bold, 17, N.ink), letterSpacing: 0.1 },
  scroll: { flex: 1 },
  mods: { borderBottomWidth: 1, borderBottomColor: N.line },
  leaveWrap: { position: 'absolute', left: 0, right: 0 },
  leave: { textAlign: 'center', ...text(qs.medium, 13, N.ink3) },
});
