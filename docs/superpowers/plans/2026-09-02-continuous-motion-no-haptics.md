# Continuous Motion and No Phone Haptics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make accelerometer-driven motor output proportional from 0–100 while removing every phone-vibration stand-in.

**Architecture:** Keep the existing 50 ms accelerometer subscription and gravity estimate, but move magnitude normalization into pure functions shared by motor and waveform output. Reduce the demo toy adapter to in-memory intensity state and remove direct React Native `Vibration` use from runtime code.

**Tech Stack:** React Native 0.73, TypeScript, react-native-sensors, Jest 29

## Global Constraints

- Start from `cursor/fix-voice-input-crash-a947`.
- Do not add real BLE/toy behavior.
- Do not change calling, female GLB, companion birthday, or login bypass behavior.
- Do not commit `.env` or `LLM_API_KEY`.
- The phone must not buzz on motion, sound, voice, auto, alarm, or idle paths.
- Jest must cover the mapper and demo motor adapter; TestFlight cannot run here.

---

### Task 1: Establish failing behavior tests

**Files:**
- Create: `src/screens/motion/shake-to-intensity.ts`
- Create: `__tests__/shake-to-intensity.test.ts`
- Create: `__tests__/toy.test.ts`

**Interfaces:**
- Produces: `shakeMagnitudeToIntensity(magnitude: number): number`
- Produces: `motionIntensityToWaveAmplitude(intensity: number): number`
- Consumes: existing `motorLevel`, `applyToyMotor`, `stopToy`, and `getToyIntensity`

- [ ] **Step 1: Write motion tests for the desired linear mapping**

```ts
import { describe, expect, it } from "@jest/globals";
import {
  motionIntensityToWaveAmplitude,
  shakeMagnitudeToIntensity,
} from "../src/screens/motion/shake-to-intensity";

describe("shakeMagnitudeToIntensity", () => {
  it("maps rest to zero intensity", () => {
    expect(shakeMagnitudeToIntensity(0)).toBe(0);
  });

  it("maps intermediate motion to intermediate intensity", () => {
    expect(shakeMagnitudeToIntensity(0.5)).toBe(28);
    expect(shakeMagnitudeToIntensity(1)).toBe(55);
  });

  it("clamps strong motion at full intensity", () => {
    expect(shakeMagnitudeToIntensity(2)).toBe(100);
  });

  it("preserves nearby intermediate levels instead of snapping to gears", () => {
    expect(shakeMagnitudeToIntensity(0.72)).toBe(40);
    expect(shakeMagnitudeToIntensity(0.74)).toBe(41);
  });
});

describe("motionIntensityToWaveAmplitude", () => {
  it("linearly maps the shared intensity onto the wave", () => {
    expect(motionIntensityToWaveAmplitude(0)).toBe(20);
    expect(motionIntensityToWaveAmplitude(50)).toBe(110);
    expect(motionIntensityToWaveAmplitude(100)).toBe(200);
  });
});
```

- [ ] **Step 2: Extract the existing stepped behavior into the mapper as the red baseline**

```ts
const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const shakeMagnitudeToIntensity = (magnitude: number): number => {
  const amplitude = clamp(Math.round(magnitude * 55));
  return amplitude < 12
    ? 0
    : amplitude < 22
    ? 25
    : amplitude < 32
    ? 50
    : amplitude < 42
    ? 75
    : 100;
};

export const motionIntensityToWaveAmplitude = (intensity: number): number =>
  intensity < 12
    ? 20
    : intensity < 28
    ? 65
    : intensity < 48
    ? 110
    : intensity < 72
    ? 155
    : 200;
```

- [ ] **Step 3: Write demo motor tests, including the no-haptic regression**

```ts
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Vibration } from "react-native";
import {
  applyToyMotor,
  getToyIntensity,
  motorLevel,
  stopToy,
} from "../src/store/toy";

describe("demo toy motor state", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    stopToy();
  });

  afterEach(() => {
    stopToy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("normalizes motor command intensity", () => {
    expect(motorLevel()).toBe(0);
    expect(motorLevel([])).toBe(0);
    expect(motorLevel([5])).toBe(70);
    expect(motorLevel([1, 42, 42, 42])).toBe(42);
    expect(motorLevel([1, 120, 120, 120])).toBe(100);
  });

  it("stores intensity without vibrating the phone", () => {
    const vibrate = jest
      .spyOn(Vibration, "vibrate")
      .mockImplementation(() => undefined);

    applyToyMotor([1, 63, 63, 63]);
    jest.advanceTimersByTime(1000);

    expect(getToyIntensity()).toBe(63);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("clears stored intensity", () => {
    applyToyMotor([1, 63, 63, 63]);
    stopToy();
    expect(getToyIntensity()).toBe(0);
  });
});
```

- [ ] **Step 4: Commit and push the red baseline, then create the draft PR**

```bash
git add src/screens/motion/shake-to-intensity.ts __tests__/shake-to-intensity.test.ts __tests__/toy.test.ts
git commit -m "test: cover continuous motion and phone haptics"
git push -u origin cursor/continuous-motion-no-haptics-25fd
```

- [ ] **Step 5: Run the focused tests and verify the intended failures**

Run: `npm test -- --runInBand __tests__/shake-to-intensity.test.ts __tests__/toy.test.ts`

Expected: mapper assertions fail on stepped values, and the vibration spy records calls.

### Task 2: Replace motion gears with one linear value

**Files:**
- Modify: `src/screens/motion/shake-to-intensity.ts`
- Modify: `src/screens/motion/motion-sensor.tsx`

**Interfaces:**
- Consumes: gravity-filtered acceleration magnitude from the existing sensor callback
- Produces: one `0…100` integer used by both `setMotorInput` and `WaveView`

- [ ] **Step 1: Implement the minimal linear mapper**

```ts
const INTENSITY_PER_SHAKE_UNIT = 55;
const MIN_WAVE_AMPLITUDE = 20;
const MAX_WAVE_AMPLITUDE = 200;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const shakeMagnitudeToIntensity = (magnitude: number): number =>
  clamp(Math.round(magnitude * INTENSITY_PER_SHAKE_UNIT));

export const motionIntensityToWaveAmplitude = (intensity: number): number =>
  MIN_WAVE_AMPLITUDE +
  (clamp(intensity) / 100) * (MAX_WAVE_AMPLITUDE - MIN_WAVE_AMPLITUDE);
```

- [ ] **Step 2: Feed the mapper output directly to state**

Add the top-level import:

```ts
import {
  motionIntensityToWaveAmplitude,
  shakeMagnitudeToIntensity,
} from "./shake-to-intensity";
```

Rename `amplitude` state to `intensity`, and replace the callback's stepped UI update with:

```ts
const next = shakeMagnitudeToIntensity(linear);
setIntensity(next);
```

Replace the output effect with:

```ts
useEffect(() => {
  setCurrentMode("motion");
  setMotorInput([1, intensity, intensity, intensity]);
  if (waveRef.current) {
    waveRef.current.setWaveParams([
      {
        A: motionIntensityToWaveAmplitude(intensity),
        T: 360,
        fill: "#CCA0DD",
      },
    ]);
  }
}, [intensity, setCurrentMode, setMotorInput]);
```

- [ ] **Step 3: Check the diff, commit, and push before green verification**

```bash
git diff --check
git add src/screens/motion/shake-to-intensity.ts src/screens/motion/motion-sensor.tsx
git commit -m "fix: make motion intensity continuous"
git push -u origin cursor/continuous-motion-no-haptics-25fd
```

- [ ] **Step 4: Run the mapper test**

Run: `npm test -- --runInBand __tests__/shake-to-intensity.test.ts`

Expected: PASS.

### Task 3: Remove every phone-vibration stand-in

**Files:**
- Modify: `src/store/toy.ts`
- Modify: `src/store/AlarmRunner.tsx`
- Modify: `src/screens/kink/kink-selection.tsx`

**Interfaces:**
- Preserves: `applyToyMotor`, `stopToy`, `motorLevel`, and `getToyIntensity`
- Removes: all runtime and inactive React Native `Vibration` references

- [ ] **Step 1: Reduce the demo adapter to state only**

```ts
let intensity = 0;

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export const motorLevel = (input?: number[] | null) => {
  if (!input || input.length === 0) {
    return 0;
  }
  if (input.length === 1) {
    return 70;
  }
  return clamp(Number(input[1]) || 0);
};

export const applyToyMotor = (input?: number[] | null) => {
  intensity = motorLevel(input);
};

export const stopToy = () => {
  intensity = 0;
};

export const getToyIntensity = () => intensity;
```

- [ ] **Step 2: Remove direct and commented haptic references**

Remove the `Vibration` import and all `Vibration.vibrate`/`Vibration.cancel`
calls from `AlarmRunner.tsx`. Remove the unused `Vibration` import and commented
vibration lines from `kink-selection.tsx`.

- [ ] **Step 3: Confirm the source has no haptic API calls**

Run: `rg "Vibration|haptic|UIImpactFeedbackGenerator|AudioServicesPlaySystemSound" src`

Expected: no phone-haptic implementation matches.

- [ ] **Step 4: Check the diff, commit, and push before green verification**

```bash
git diff --check
git add src/store/toy.ts src/store/AlarmRunner.tsx src/screens/kink/kink-selection.tsx
git commit -m "fix: stop using the phone as a demo toy"
git push -u origin cursor/continuous-motion-no-haptics-25fd
```

- [ ] **Step 5: Run all focused regression tests**

Run: `npm test -- --runInBand __tests__/shake-to-intensity.test.ts __tests__/toy.test.ts`

Expected: PASS.

### Task 4: Verify the stacked change

**Files:**
- Verify only

**Interfaces:**
- Confirms: focused behavior, full Jest suite, TypeScript, lint, secret hygiene, and branch scope

- [ ] **Step 1: Run the full Jest suite**

Run: `npm test -- --runInBand`

Expected: all suites pass.

- [ ] **Step 2: Run TypeScript and lint checks**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors introduced by this branch.

Run: `npm run lint`

Expected: no lint errors introduced by this branch.

- [ ] **Step 3: Verify scope and secrets**

```bash
git diff --check cursor/fix-voice-input-crash-a947...HEAD
git diff --name-only cursor/fix-voice-input-crash-a947...HEAD
git status --short
```

Expected: only design/plan docs, motion mapper/screen, toy/alarm/kink haptic cleanup,
and focused tests are changed; `.env` and generated LLM secret files are absent.

- [ ] **Step 4: Update the PR with final verification**

Push any verification fixes as separate focused commits, then update the draft
PR body and mark it ready for review.
