/**
 * Smoke test: the placeholder screen renders through useAdvancedControl on the
 * simulator, and unmounting (leaving the page) sends STOP.
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-ble-manager', () => ({}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => undefined,
  useRoute: () => ({ name: 'AdvancedControl' }),
  useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
}));
jest.mock('@common/components/screen-wrapper', () => ({
  ScreenWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

import { AdvancedControlScreen } from '../../src/screens/advanced-control';
import { getIcd001Client, setIcd001Mode } from '../../src/services/icd001/useIcd001';

const texts = (r: renderer.ReactTestRenderer) =>
  r.root
    .findAll(n => (n.type as unknown) === 'Text')
    .map(n => [].concat(n.props.children as never).join(''))
    .join('\n');

describe('AdvancedControlScreen (placeholder) on the mock', () => {
  beforeAll(async () => {
    jest.useFakeTimers({ now: 11_000_000 });
    await setIcd001Mode('mock');
  });
  afterAll(() => {
    getIcd001Client().destroy();
    jest.useRealTimers();
  });

  it('renders disconnected, then connected cards; unmount sends STOP', async () => {
    let r!: renderer.ReactTestRenderer;
    await act(async () => {
      r = renderer.create(<AdvancedControlScreen />);
    });
    expect(texts(r)).toContain('State: disconnected');
    const client = getIcd001Client();
    await act(async () => {
      const p = client.connect({
        id: 'sim-ICD1-5A3C',
        name: 'ICD1-5A3C',
        rssi: -50,
        kind: null,
        simulated: true,
      });
      for (let i = 0; i < 100; i++) {
        await jest.advanceTimersByTimeAsync(10);
      }
      await p;
    });
    const t = texts(r);
    expect(t).toContain('State: normal');
    expect(t).toContain('Wings · A 0 · B 0 · Steady');
    expect(t).toContain('Pulse · Off');
    expect(t).toContain('Bullet');
    const sent: string[] = [];
    const unsub = client.subscribe(s => {
      const last = s.log[s.log.length - 1];
      if (last) {
        sent.push(last);
      }
    });
    await act(async () => {
      r.unmount();
      await jest.advanceTimersByTimeAsync(50);
    });
    unsub();
    expect(sent.some(l => l.includes('STOP'))).toBe(true);
  });
});
