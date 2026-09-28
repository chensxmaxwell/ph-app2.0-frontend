# Advanced control: safety rules (app side)

These are app-side rules for the ICD-001 advanced-control page (`src/screens/advanced-control`). They sit alongside design v2 "Nocturne" (`ph-icd001-advanced-control/design-v2/spec.md`, not edited here). Where the two conflict, this file wins.

## Rule 1: Stop all is never hidden by a sheet or overlay
Signed off by design on 2026-09-29.

While any sheet, dialog or overlay on this page is open (the rule was written for the Fine tune sheet, which has since been removed; it applies to every future overlay):

1. **Stop all stays visible and tappable, and it is not dimmed by the scrim.**
2. **The sheet's bottom edge stops just above Stop all.** Sheets and the scrim are laid out above a reserved Stop-all zone:
   - the zone's height is `stopZoneHeight(stopBottom)`, which is Stop all's bottom offset + the 58 pt button + a 12 pt gap;
   - the zone is filled with the page's bottom background colour and blocks touches to the page underneath.
3. **Stop all stays fixed above both the scrim and the sheet, in exactly its normal position and style.** Never move it into a sheet.
4. **Tapping Stop all while a sheet is open does two things:** it closes the sheet and enters the e-stop state (`ESTOP 1`, then Stopped + Release).

### How it is enforced
- **OverlayHost:** `components/OverlayHost.tsx` is the page-level overlay host. Every sheet on this page must be rendered through `<OverlayHost>`, never through React Native `<Modal>`, because a Modal draws above the whole page, including Stop all. The rule is repeated as a boxed comment at the top of that file.
- **Render order and dismissal:** `index.tsx` renders `<OverlayHost>` and then `<StopDock>` last, so Stop all is the topmost layer. The Stop all handler clears the open sheet before calling `ctl.stopAll()`. A future sheet whose controls stop applying on pause, e-stop or disconnect should close itself in the same way.
- **Tests:** `__tests__/icd001/advanced-sheet-safety.test.tsx` opens a sheet via the screen's `initialOverlay` prop and checks three things:
  - Stop all is pressable while the sheet is open;
  - pressing it closes the sheet and sends `ESTOP 1`;
  - the scrim doesn't cover it (it isn't inside the host, it comes after the host in z-order, the scrim and sheet end at or above its top edge, and no opacity is applied to it).

### Adding a new sheet
Set the page's `sheet` state to the sheet's content; the screen renders it inside the existing `<OverlayHost>`. Don't create another overlay mechanism.

## Rule 2: wing frequency is fixed at 170 Hz
Maxwell, 2026-09-29.

- **No UI.** The wing (LRA) drive frequency is not user-adjustable, and the page state has no frequency action.
- **One correction per connection.** Once INFO and the first telemetry arrive, the controller checks the device's frequency: the TLM `f` value, or INFO `ch.freq.def` when telemetry doesn't report one. If it isn't 170, the controller sends `FREQ 170` once for that connection; otherwise it sends nothing. The logic is `wingFreqCorrection()` in `model.ts` and `ensureWingFreq()` in `controller.ts`.
- **Debug screen.** The low-level `client.setFreq()` stays available for the BLE debug screen.
