/**
 * 高级控制 (Advanced control), design v4 (design-v4/spec.md): the App's own
 * style (STYLE-DIGEST): ScreenWrapper gradient, Playground/Sync stack header,
 * glass module cards, Quicksand-Bold only, light-pink accent. Stack screen, so
 * no tab bar; the bottom 108 pt are reserved for Stop all.
 * Rendering only: state, priorities, command mapping and auto-STOP live in
 * useAdvancedControl / controller.ts / model.ts.
 */
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Gradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenWrapper } from '../../common/components/screen-wrapper/hooks';

import { BLOB } from './assets';
import { ModeSwitch } from './components/ModeSwitch';
import { Notice } from './components/Notice';
import { OverlayHost, contentBottomPadding, stopZoneHeight } from './components/OverlayHost';
import { StopDock } from './components/StopDock';
import { ValueSlider } from './components/ValueSlider';
import { LinkPill, ModuleCard, PulseSwitch } from './components/parts';
import { Chevron, Icon } from './icons';
import { text, v4 } from './theme';
import { useAdvancedControl } from './useAdvancedControl';

import type { CardId, CardView, IntensityView, RhythmView, SensorView } from './controller';
import type { SrcState } from './model';

/** Kept for deep links from older builds / the QA harness; v4 has no collapsible rows. */
export type AdvancedControlParams = { expanded?: CardId } | undefined;

type Dragging = 'A' | 'B' | 'vcm' | null;

export interface AdvancedControlProps {
  initialOverlay?: React.ReactNode;
  /** Header title. The Manual page hosts this same screen as "Manual" (Turn 13). */
  title?: string;
  /** Show the Wings / Pulse & Bullet cards (disabled) before the first connect (Manual). */
  placeholderCards?: boolean;
}

export const AdvancedControlScreen = ({
  initialOverlay,
  title: screenTitle = 'Advanced control',
  placeholderCards = false,
}: AdvancedControlProps = {}) => {
  const { view, ctl } = useAdvancedControl({ placeholderCards });
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bg = useScreenWrapper().getBackgroundTypeConfig(undefined);
  /**
   * Open sheet/overlay content, if any. Every overlay on this page goes through
   * <OverlayHost> (Stop-all safety rule). No overlay is used in design v4;
   * `initialOverlay` exists for previews and the safety tests.
   */
  const [sheet, setSheet] = useState<React.ReactNode | null>(initialOverlay ?? null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const [dragging, setDragging] = useState<Dragging>(null);
  const dragProps = (key: Exclude<Dragging, null>) => ({
    onDragChange: (on: boolean) => setDragging(on ? key : null),
  });

  const { screen, banner, device } = view;
  const live = screen.kind !== 'disconnected';
  const cards: CardView[] = live ? view.cards : view.lastSeen;
  const stopBottom = Math.max(insets.bottom + 4, 16);
  const zone = stopZoneHeight(stopBottom);

  /**
   * Auto (ICD001-1): controls show the device's actual output and take no
   * input. A touch shows "Auto is on / Tap Manual to take over" (never a
   * silent takeover, §11.5.5 is done by the Auto | Manual control only).
   */
  const readOnly = (key: string, node: React.ReactNode) => (
    <Pressable
      onPress={() => ctl.autoHint()}
      accessibilityRole="button"
      accessibilityLabel="Auto is on. Tap Manual to take over"
      testID={`readonly-${key}`}
    >
      <View style={styles.auto} pointerEvents="none">
        {node}
      </View>
    </Pressable>
  );

  const wings = (c: IntensityView) => {
    const off = !c.enabled;
    const sliders = c.card.groups.map((g, i) => (
      <ValueSlider
        key={g.id}
        first={i === 0}
        label={g.name}
        value={c.values[g.id]}
        min={0}
        max={100}
        unit="%"
        disabled={off}
        onChange={v => ctl.setWingValue(g.id, v)}
        onRelease={v => ctl.setWingValue(g.id, v)}
        testID={`slider-${g.id}`}
        {...dragProps(g.id)}
      />
    ));
    if (c.readOnly) {
      return (
        <ModuleCard key="wing" blob={BLOB.wingsCard} title={c.card.label} testID="card-wing">
          {readOnly('wing', <View testID="controls-wing">{sliders}</View>)}
        </ModuleCard>
      );
    }
    return (
      <ModuleCard key="wing" blob={BLOB.wingsCard} title={c.card.label} testID="card-wing">
        <View style={off && styles.dim} testID="controls-wing" pointerEvents={off ? 'none' : 'auto'}>
          {sliders}
        </View>
      </ModuleCard>
    );
  };

  /** Bullet read-out (skin contact + heart rate), or "No signal". Read-only, never dimmed by e-stop. */
  const bulletReadout = (c: SensorView) => {
    const r = c.reading;
    if (!(live && r.available)) {
      return <Text style={[styles.ro, styles.dim]}>No signal</Text>;
    }
    return (
      <View style={styles.readouts} accessible accessibilityLabel={bulletA11y(r.contact, r.hr)}>
        <Text style={styles.ro}>{r.contact ? 'On skin' : 'Not on skin'}</Text>
        <View style={styles.hr}>
          <Icon name="heart" size={16} color={v4.white} />
          <Text style={[styles.ro, styles.bpm]}>{r.contact && r.hr ? `${r.hr} bpm` : '-- bpm'}</Text>
        </View>
      </View>
    );
  };

  /**
   * One card for Pulse + Bullet (Maxwell 2026-10-04). Head: pulse blob +
   * "Pulse & Bullet". Then the Pulse block (label row with the on/off switch,
   * speed slider; dimmed together when outputs are blocked), then the Bullet
   * row: read-only (skin contact + heart rate, no control), blob 32 + "Bullet"
   * label, read-out on the right, set apart from the Pulse controls by 12 pt of
   * spacing inside the same card (no nested card, no divider: STYLE-DIGEST).
   * Same 13 pt label / right-aligned control rhythm as the slider rows.
   * Either part is left out if the device does not report it.
   */
  const pulseBullet = (p: RhythmView | undefined, b: SensorView | undefined) => {
    const off = p ? !p.enabled : false;
    const title = p && b ? 'Pulse & Bullet' : p ? p.card.label : b!.card.label;
    const pzeroBtn = view.mode.pzero ? (
      <Pressable
        onPress={() => ctl.pzero()}
        disabled={view.mode.pzero === 'busy'}
        accessibilityRole="button"
        accessibilityLabel="Re-zero pressure"
        accessibilityState={{ busy: view.mode.pzero === 'busy' }}
        style={({ pressed }) => [styles.btn, (pressed || view.mode.pzero === 'busy') && styles.pressed]}
        testID="pzero"
      >
        <Text style={styles.btnText}>{view.mode.pzero === 'busy' ? 'Re-zeroing…' : 'Re-zero pressure'}</Text>
      </Pressable>
    ) : null;
    const pulseSlider = p ? (
      <ValueSlider
        label="Pulse speed"
        value={p.hz}
        min={p.range.min}
        max={p.range.max}
        unit=" Hz"
        idle={!p.on && dragging !== 'vcm'}
        disabled={off}
        onChange={hz => ctl.setPulseHz(hz)}
        onRelease={hz => ctl.setPulseHz(hz)}
        testID="slider-vcm"
        {...dragProps('vcm')}
      />
    ) : null;
    return (
      <ModuleCard key="vcm-egg" blob={p ? BLOB.pulse : BLOB.bullet} title={title} testID="card-pulse-bullet">
        {p && p.readOnly ? (
          // Auto: the Pulse row carries Re-zero pressure (§11.4.14; pressure drives Pulse) in
          // place of the switch; the speed slider shows the actual 5–10 Hz output read-only.
          <>
            <View style={styles.subRow} testID="row-pzero">
              <Text style={styles.subLabel}>{p.card.label}</Text>
              <View style={styles.subRight}>{pzeroBtn}</View>
            </View>
            {readOnly('vcm', <View testID="controls-vcm">{pulseSlider}</View>)}
          </>
        ) : null}
        {p && !p.readOnly ? (
          <View style={off && styles.dim} testID="controls-vcm" pointerEvents={off ? 'none' : 'auto'}>
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>{p.card.label}</Text>
              <View style={styles.subRight}>
                <PulseSwitch value={p.on} onChange={on => ctl.setPulseOn(on)} disabled={off} label="Pulse" />
              </View>
            </View>
            {pulseSlider}
          </View>
        ) : null}
        {b ? (
          <View style={[styles.subRow, p ? styles.bulletRow : null]} testID="row-bullet">
            {p ? <Image source={BLOB.bullet} style={styles.subBlob} /> : null}
            {p ? <Text style={styles.subLabel}>{b.card.label}</Text> : null}
            <View style={styles.subRight}>{bulletReadout(b)}</View>
          </View>
        ) : null}
        {b && b.sensors ? (
          <View
            style={styles.subRow}
            testID="row-sensors"
            accessible
            accessibilityLabel={sensorsA11y(b.sensors)}
          >
            <Text style={styles.subLabel}>Sensors</Text>
            <View style={styles.subRight}>
              {(
                [
                  ['Pressure', b.sensors.pressure],
                  ['Upper', b.sensors.upper],
                  ['Lower', b.sensors.lower],
                ] as const
              ).map(([label, st]) => (
                <View key={label} style={styles.chip} testID={`src-${label.toLowerCase()}-${st}`}>
                  <View style={[styles.srcDot, { backgroundColor: SRC_COLOR[st] }]} />
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ModuleCard>
    );
  };

  const wingCards = cards.filter((c): c is IntensityView => c.kind === 'intensity');
  const rhythm = cards.find((c): c is RhythmView => c.kind === 'rhythm');
  const sensor = cards.find((c): c is SensorView => c.kind === 'sensor');

  return (
    <View style={styles.root} testID="advanced-control">
      <StatusBar barStyle="light-content" />
      <Gradient {...bg} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: contentBottomPadding(stopBottom) }}
        testID="advanced-scroll"
        showsVerticalScrollIndicator={false}
        scrollEnabled={dragging === null}
      >
        {/* Stack header (playground/index.tsx header + backIcon): paddingTop 60, chevron 35 at left 20. */}
        <View style={styles.header}>
          <Text style={styles.h1} accessibilityRole="header">
            {screenTitle}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={6}
            style={styles.back}
          >
            <Chevron dir="left" size={35} color={v4.white} />
          </Pressable>
        </View>
        <View style={styles.pillRow}>
          <LinkPill
            connected={live}
            connecting={screen.connecting}
            batteryPct={device.batteryPct}
            onPress={() => ctl.reconnect()}
          />
          {view.mode.supported ? (
            <View style={styles.modeRow}>
              <ModeSwitch
                current={view.mode.current}
                switching={view.mode.switching}
                autoAllowed={view.mode.autoAllowed}
                onChange={m => ctl.setMode(m)}
              />
            </View>
          ) : null}
        </View>
        <View style={[styles.stack, view.mode.supported && styles.stackUnderMode]}>
          {banner ? (
            <Notice
              model={banner}
              busy={view.scan.connecting}
              onAction={a => (a === 'reconnect' ? ctl.reconnect() : ctl.scan())}
            />
          ) : null}
          {view.toast ? <Notice model={{ tone: 'neutral', icon: 'info', ...view.toast }} /> : null}
          {wingCards.map(wings)}
          {rhythm || sensor ? pulseBullet(rhythm, sensor) : null}
        </View>
      </ScrollView>
      {/* Sheets: laid out above the reserved Stop-all zone. See the SAFETY RULE in OverlayHost. */}
      <OverlayHost visible={sheet !== null} onClose={closeSheet} reserveBottom={zone}>
        {sheet}
      </OverlayHost>
      {/* Stop all: rendered LAST so it is the topmost layer, above any scrim or sheet. */}
      <StopDock
        engaged={view.estop.on}
        bottom={stopBottom}
        overlayOpen={sheet !== null}
        onStop={() => {
          setSheet(null); // safety rule: Stop all closes any open sheet and enters e-stop
          ctl.stopAll();
        }}
        onRelease={() => ctl.release()}
      />
    </View>
  );
};

const SRC_COLOR: Record<SrcState, string> = { ok: v4.green, part: v4.accent, off: v4.red };
const SRC_WORD: Record<SrcState, string> = { ok: 'ready', part: 'partly off', off: 'off' };

function sensorsA11y(s: { pressure: SrcState; upper: SrcState; lower: SrcState }): string {
  return `Sensors: pressure ${SRC_WORD[s.pressure]}, upper ${SRC_WORD[s.upper]}, lower ${SRC_WORD[s.lower]}`;
}

function bulletA11y(contact: boolean, hr: number | null): string {
  return contact ? `On skin, heart rate ${hr ? `${hr} bpm` : 'measuring'}` : 'Not on skin';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: v4.ink },
  scroll: { flex: 1 },
  header: { marginTop: 60, height: 35, alignItems: 'center' },
  h1: text(20, v4.white, 25),
  back: { position: 'absolute', left: 20, top: 0, width: 35, height: 35 },
  pillRow: { marginTop: 20, alignItems: 'center' },
  stack: { marginTop: 24, marginHorizontal: 24, gap: 12 },
  /** Under the Auto | Manual control: 16 pt (the control already spaces it from the pill). */
  stackUnderMode: { marginTop: 16 },
  dim: { opacity: v4.dimOpacity },
  /** Auto: read-only live output, lighter than the paused dim so movement stays visible. */
  auto: { opacity: 0.7 },
  modeRow: { marginTop: 12, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  srcDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  chipText: text(13, v4.white, 17),
  btn: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: v4.white,
    backgroundColor: v4.pill,
    justifyContent: 'center',
  },
  btnText: text(13, v4.white, 17),
  pressed: { opacity: 0.7 },
  readouts: { flexDirection: 'row', alignItems: 'center' },
  ro: text(14, v4.white, 18),
  hr: { flexDirection: 'row', alignItems: 'center', marginLeft: 14 },
  bpm: { marginLeft: 6, minWidth: 54, textAlign: 'right' },
  /** Card sub-rows: label 13 left, control/read-out right (slider label rhythm). */
  subRow: { marginTop: 12, minHeight: 31, flexDirection: 'row', alignItems: 'center' },
  subLabel: text(13, v4.white, 17),
  subRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  // 12 pt like the stack gap (was 16): keeps the e-stop / over-temp page within 724 pt, i.e. 12 pt above the Stop-all zone
  bulletRow: { marginTop: 12 },
  subBlob: { width: 32, height: 32, marginLeft: -4, marginRight: 6 },
});
