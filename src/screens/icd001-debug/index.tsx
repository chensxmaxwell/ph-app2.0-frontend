/**
 * ICD-001 BLE debug screen (engineering only, reachable in __DEV__ builds from
 * the top-right "BLE" chip on the Control hub). Placeholder until the
 * 高级控制 page is built from design-v1/spec.md; it exercises the whole
 * service layer: scan, connect, INFO modules, TLM, throttled sliders, STOP,
 * E-stop, simulator.
 */
import { Slider } from '@miblanchard/react-native-slider';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LOCK_REASON_TEXT } from '../../services/icd001/client';
import { MockIcd001Transport } from '../../services/icd001/mock';
import { setIcd001Mode, useIcd001, useIcd001SafetyStop } from '../../services/icd001/useIcd001';

const Btn = ({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[styles.btn, danger && styles.btnDanger, disabled && styles.btnDisabled]}
  >
    <Text style={styles.btnText}>{label}</Text>
  </TouchableOpacity>
);

export const Icd001DebugScreen = () => {
  const navigation = useNavigation();
  const { state, client, mode } = useIcd001();
  useIcd001SafetyStop();

  const wings = state.info?.modules.wings ?? null;
  const vcm = state.info?.modules.vcm ?? null;
  const [lra, setLra] = useState<[number, number]>([0, 0]);
  const [vhz, setVhz] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Device is the source of truth: snap sliders to telemetry when not dragging
  // (also covers ERR replies and firmware-side stops).
  useEffect(() => {
    if (!dragging && state.tlm) {
      setLra([state.tlm.lra[0], state.tlm.lra[1]]);
      setVhz(state.tlm.vcm.on ? state.tlm.vcm.hz ?? 0 : 0);
    }
  }, [state.tlm, dragging]);

  const t = state.tlm;
  const disabled = state.locked;
  const sim = client.transport instanceof MockIcd001Transport ? client.transport : null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Btn label="‹ 返回" onPress={() => navigation.goBack()} />
          <Text style={styles.title}>ICD-001 BLE 调试</Text>
        </View>

        <View style={styles.row}>
          <Btn label={mode === 'ble' ? '● 真机 BLE' : '○ 真机 BLE'} onPress={() => setIcd001Mode('ble')} />
          <Btn label={mode === 'mock' ? '● 模拟器' : '○ 模拟器'} onPress={() => setIcd001Mode('mock')} />
        </View>

        <Text style={styles.kv}>
          状态：{state.status}
          {state.device ? ` · ${state.device.name ?? state.device.id}` : ''}
          {state.mtu ? ` · MTU ${state.mtu}` : ''}
          {state.reconnectAttempt ? ` · 重连 #${state.reconnectAttempt}` : ''}
        </Text>
        {state.error ? <Text style={styles.err}>{state.error}</Text> : null}
        {state.locked ? (
          <Text style={styles.warn}>
            控制已锁定：
            {state.lockReasons.map(r => LOCK_REASON_TEXT[r]).join('、')}
          </Text>
        ) : null}

        <View style={styles.row}>
          <Btn label="扫描" onPress={() => client.startScan()} />
          <Btn label="断开" onPress={() => client.disconnect()} />
        </View>
        {state.devices.map(d => (
          <TouchableOpacity key={d.id} style={styles.device} onPress={() => client.connect(d)}>
            <Text style={styles.kv}>
              {d.name ?? '(无名)'} · {d.kind ?? '?'} · RSSI {d.rssi ?? '—'} {d.simulated ? '· 模拟' : ''}
            </Text>
          </TouchableOpacity>
        ))}

        {state.info ? (
          <View style={styles.card}>
            <Text style={styles.h}>INFO</Text>
            <Text style={styles.kv}>
              prod {state.info.prod ?? '—'} · hw {state.info.hw ?? '—'} · fw {state.info.fw ?? '—'}
              {state.info.legacy ? '（H11 v1.0 旧固件）' : ` · ${state.info.proto}`}
            </Text>
            <Text style={styles.kv}>
              翅膀：
              {wings ? wings.groups.map(g => `${g.id}=${g.label}`).join(' ') : '无'} · 音圈：
              {vcm ? `${vcm.minHz}–${vcm.maxHz} Hz（${vcm.command}）` : '无'} · 跳蛋：
              {state.info.modules.egg
                ? `PPG#${state.info.modules.egg.ppgIndex}${
                    state.info.modules.egg.hasActuator ? '' : '，无执行器'
                  }`
                : '无'}
            </Text>
          </View>
        ) : null}

        {t ? (
          <View style={styles.card}>
            <Text style={styles.h}>遥测</Text>
            <Text style={styles.kv}>
              电量 {t.batteryPct ?? '—'}%（{t.vbat ?? '—'} V）· 温度 {t.ntcC ?? '—'} °C · estop{' '}
              {t.estop ? 1 : 0} · ot {t.ot ? 1 : 0}
            </Text>
            <Text style={styles.kv}>
              LRA A {t.lra[0]} · B {t.lra[1]} · {t.lraFreqHz ?? '—'} Hz · 音圈{' '}
              {t.vcm.on ? `${t.vcm.hz} Hz` : '关'}
            </Text>
            <Text style={styles.kv}>
              PPG{' '}
              {t.ppg
                .map((p, i) => `#${i}:${p.contact ? '接触' : '—'}${p.hr ? ` ${p.hr}bpm` : ''}`)
                .join('  ')}
            </Text>
          </View>
        ) : null}

        {wings?.groups.map(g => (
          <View key={g.id}>
            <Text style={styles.kv}>
              翅膀 {g.label}（{g.id}）：{Math.round(lra[g.index])}
            </Text>
            <Slider
              value={lra[g.index]}
              minimumValue={0}
              maximumValue={100}
              step={1}
              disabled={disabled}
              onSlidingStart={() => setDragging(true)}
              onSlidingComplete={() => setDragging(false)}
              onValueChange={v => {
                const val = Array.isArray(v) ? v[0] : v;
                setLra(prev => (g.index === 0 ? [val, prev[1]] : [prev[0], val]));
                client.setLra(g.id, val);
              }}
            />
          </View>
        ))}

        {vcm ? (
          <View>
            <Text style={styles.kv}>
              音圈脉冲：{vhz ? `${Math.round(vhz)} Hz` : '关'}（{vcm.minHz}–{vcm.maxHz} Hz，最左为关）
            </Text>
            <Slider
              value={vhz ? vhz : vcm.minHz - 1}
              minimumValue={vcm.minHz - 1}
              maximumValue={vcm.maxHz}
              step={1}
              disabled={disabled}
              onSlidingStart={() => setDragging(true)}
              onSlidingComplete={() => setDragging(false)}
              onValueChange={v => {
                const raw = Array.isArray(v) ? v[0] : v;
                const hz = raw < vcm.minHz ? 0 : raw;
                setVhz(hz);
                client.setVcmHz(hz);
              }}
            />
          </View>
        ) : null}

        {wings?.lpulse ? (
          <View style={styles.row}>
            <Btn
              label="A 组节奏 60% 300/300 ms"
              disabled={disabled}
              onPress={() => client.setLpulse('A', 60, 300, 300)}
            />
            <Btn label="A 组恢复常振" disabled={disabled} onPress={() => client.setLra('A', lra[0])} />
          </View>
        ) : null}
        {t && (t.lp[0][0] || t.lp[1][0]) ? (
          <Text style={styles.kv}>
            节奏 A {t.lp[0].join('/')} · B {t.lp[1].join('/')} ms
          </Text>
        ) : null}

        <View style={styles.row}>
          <Btn label="STOP" danger onPress={() => client.stop()} />
          <Btn
            label={state.estop ? '解除急停' : '急停'}
            danger
            onPress={() => client.setEstop(!state.estop)}
          />
        </View>

        {sim && state.device ? (
          <View style={styles.row}>
            <Btn label="模拟 START 键" onPress={() => sim.pressStartKey(state.device!.id)} />
            <Btn
              label="模拟过温"
              onPress={() => {
                const d = sim.devices.get(state.device!.id);
                if (d) {
                  d.ntcOverride = d.ntcOverride === null ? 43 : null;
                }
              }}
            />
            <Btn label="模拟断线" onPress={() => sim.simulateLinkLoss(state.device!.id)} />
          </View>
        ) : null}

        {state.lastErr ? <Text style={styles.err}>最近错误：{state.lastErr.text}</Text> : null}
        <View style={styles.card}>
          {state.log.slice(-15).map((l, i) => (
            <Text key={i} style={styles.log}>
              {l}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  h: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  kv: { color: '#ddd', fontSize: 13 },
  warn: { color: '#ffb020', fontSize: 13 },
  err: { color: '#ff5a5a', fontSize: 13 },
  card: { backgroundColor: '#1d1d22', borderRadius: 8, padding: 10 },
  device: { backgroundColor: '#23232a', borderRadius: 8, padding: 10 },
  btn: {
    backgroundColor: '#333',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnDanger: { backgroundColor: '#8a1f2b' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 13 },
  log: { color: '#9a9', fontSize: 11, fontFamily: 'Menlo' },
});
