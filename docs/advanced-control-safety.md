# Advanced control: safety rules (app side)

These are app-side rules for the ICD-001 advanced-control page (`src/screens/advanced-control`). They sit alongside design v4 (`ph-icd001-advanced-control/design-v4/spec.md`, App style; not edited here). Where the two conflict, this file wins.

## Rule 1: Stop all is never hidden by a sheet or overlay
Signed off by design on 2026-09-29.

While any sheet, dialog or overlay on this page is open (the rule was written for the Fine tune sheet, which has since been removed; it applies to every future overlay):

1. **Stop all stays visible and tappable, and it is not dimmed by the scrim.**
2. **The sheet's bottom edge stops just above Stop all.** Sheets and the scrim are laid out above a reserved Stop-all zone:
   - the zone's height is `stopZoneHeight(stopBottom)`, which is Stop all's bottom offset + the 58 pt button + a 12 pt gap;
   - the zone is filled with the page's bottom background colour (`#2A2659`) and blocks touches to the page underneath. Without a sheet the same 108 pt zone is always reserved (gradient fade), so content scrolls under Stop all, never over it.
   - the page's scroll content has `paddingBottom = contentBottomPadding(stopBottom)` = zone + 12 pt (`CONTENT_ZONE_GAP`; 120 pt on a 34 pt home-indicator iPhone). Content taller than the screen scrolls, and scrolled to the bottom the last card always ends at least 12 pt above the zone, in every notice state (design review 2026-10-04; `advanced-screen.test.tsx` "Stop-all zone bottom padding").
3. **Stop all stays fixed above both the scrim and the sheet, in exactly its normal position and style.** Never move it into a sheet.
4. **Tapping Stop all while a sheet is open does two things:** it closes the sheet and enters the e-stop state (`ESTOP 1`, then the dock shows "● Stopped" + Unlock).

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

## Rule 3: e-stop, Unlock and the offline Stop all
Design v4 §5–§6; checked against `firmware/PROTOCOL-ICD001.md` §5, §7.5, §9.

1. **Stop all (connected)** sends `ESTOP 1`. The page shows the notice "Everything is stopped" and every slider drops to 0 at once (optimistic, before TLM; the page shows no numbers, only slider positions). The dock becomes "● Stopped" + Unlock.
2. **Unlock** sends `ESTOP 0`. The firmware keeps no set values while latched (§7.5), so everything stays at 0; nothing is resumed by the app. The device START key also toggles the latch (§8.3); the page follows `EVT ESTOP n`.
3. **Disconnected:** the firmware has already stopped everything (§5). Controls are dimmed (0.4) and not pressable; Stop all stays fully pressable. Pressing it queues an e-stop: on the next connect `ESTOP 1` is written right after INFO, before `RATE` and before the page reports connected, so the device comes back latched (the notice reads "Connection lost" / "Stop all stays on." while queued). Notices are always two lines (title + one line); the e-stop notice is "Everything is stopped" / "Tap Unlock when you are ready." ("Stop all is still on" or "Stopped with the device button" as the title when the latch was not set by this app, §10.1).
4. **Leaving the page** with a queued e-stop downgrades it to a plain `STOP` on connect. A latch applied after the user left would lock the device behind another page with no Unlock in sight. Leaving always sends `STOP` when connected (unchanged).
5. Whether the firmware latch itself survives a BLE disconnect is not specified by the protocol; the client resets its e-stop state on connect and the next TLM/`OK ESTOP` corrects it.
