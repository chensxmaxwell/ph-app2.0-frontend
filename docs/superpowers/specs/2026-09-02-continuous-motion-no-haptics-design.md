# Continuous Motion and No Phone Haptics Design

## Goal

Make Playground → Motion Sensor produce a proportional toy intensity from the
iPhone accelerometer while keeping the iPhone itself completely still.

## Root cause

`motion-sensor.tsx` already derives a gravity-filtered linear acceleration
magnitude every 50 ms and scales it into `0…100`. It then discards that
resolution by quantizing motor output to `0/25/50/75/100` and wave amplitude to
five fixed heights.

Separately, `HomeScreenContext` sends non-BLE motor input to `applyToyMotor`.
That demo implementation starts a timer that calls React Native
`Vibration.vibrate`, so motion, sound, auto, and other non-zero demo motor
commands buzz the phone.

## Design

Extract a pure `shakeMagnitudeToIntensity` mapper beside the motion screen. It
will preserve the current sensor calibration of 55 intensity points per unit of
gravity-filtered acceleration, round to the integer command range, and clamp to
`0…100`. Thus rest maps to `0`, ordinary intermediate readings retain
intermediate values, and strong motion saturates at `100` without thresholds or
gears.

The screen will use that single intensity value for both outputs:

- `setMotorInput([1, intensity, intensity, intensity])`
- wave amplitude linearly interpolated from `20` at 0% to `200` at 100%

The existing 50 ms sampling and gravity low-pass filter remain unchanged. No
additional stateful smoothing is introduced in this focused fix.

`applyToyMotor` will retain only the normalized intensity number used by the
demo/UI state. It will not create timers or call a platform vibration API.
`stopToy` will only reset that state. The alarm runner's direct
`Vibration.vibrate` call and remaining inactive vibration references will also
be removed so the source tree has no phone-haptic stand-in.

## Tests

Jest tests will prove:

- rest, intermediate, and strong shake magnitudes map to low, intermediate, and
  high intensities;
- nearby intermediate magnitudes produce nearby distinct outputs rather than
  snapping to a gear;
- wave amplitude follows the same intensity linearly;
- `motorLevel` keeps its existing normalization behavior;
- `applyToyMotor` stores intensity without calling `Vibration.vibrate`, even
  after timers advance; and
- `stopToy` clears the stored intensity.

## Scope

This change does not add BLE or toy integrations and does not alter calling,
companion assets or birthday data, login bypasses, voice-input behavior, or
secrets.
