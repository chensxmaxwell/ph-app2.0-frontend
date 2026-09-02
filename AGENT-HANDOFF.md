# Pleasure House frontend — agent handoff

Read this file first. It is the working memory for the next agent: product decisions, where code lives, how previous work was done, what is finished, and what to do next.

**Start in this order:** this file → `docs/FIGMA-UI20-PRD.md` (screen inventory) → `App.tsx` (providers) → `navigations/home-stack.tsx` (routes) → `src/common/constant/index.ts` (`SCREENS`). Then jump to the file map in §4 for the area you are changing.

**Workspace:** `/Users/maxwell/Downloads/ph-app2.0-frontend-main`  
**App name:** Pleasure House (`package.json` → `@app/pleasure-house`)  
**Stack:** React Native 0.73.6, React 18, TypeScript, React Navigation 6 native stack + bottom tabs, Apollo Client, StyleSheet only (no Tailwind).  
**Owner / tester:** one person on an iPhone. Not launching to production. Every feature should *feel complete* on that phone (local / simulated is OK). Figma is a visual reference, not sacred if product logic is clearer.

---

## 1. How previous work was done (process)

### Design → code

1. Figma file **PH-UIUX-v1.0**, fileKey `5xgSMNYkdzAggSScwOn00A`.  
   Page to implement: **UI 2.0-front end (read me!)** node `3005:5377`.  
   Device canvas: **393 × 854**.  
   Out of scope: UI 1.5, iWatch, Web, other Figma pages.
2. Screen inventory / flows: `docs/FIGMA-UI20-PRD.md`.
3. Figma MCP (`plugin-figma-figma`) is **read-only** on this team seat (Dev). Do **not** spend time on `use_figma` writes. Use `get_design_context`, `get_screenshot`, `get_metadata`.
4. **Download Figma icons/assets.** Do not hand-draw SVGs if Figma has them. Assets live under `assets/` and are imported as `@images/...`.
5. Layout: React Native `StyleSheet` + `s()` from `src/screens/avatar/scale.ts` (`DESIGN_WIDTH = 393`). Pixel-perfect 1:1 is **not** required unless a screen is drastically wrong.
6. Do **not** treat incomplete/wrong Figma logic as blocking. Product behavior wins (the Love pill is the main example).

### Implementation habits that kept the app from rotting

- Wire **dead buttons** when you find them. Do not leave `View`s that look tappable.
- Love / Call / Sync are **transparent modals**. Never `navigate` from them to a **non-modal** screen (Pattern, Kink, Bliss, Sync stack). The new screen goes **under** the overlay and looks “broken.” Use `dismissLoveOverlays()` in `src/screens/love/overlay.ts`, then navigate.
- Prefer local mock + AsyncStorage over waiting for backend.
- Login has **Bypass login** for local work (`src/screens/auth/login/hooks.ts` → `handleBypassLogin`). Facebook/Apple currently also call bypass.
- After UI changes, verify on simulator/device. Assistive tap automation on this Mac’s Simulator is often blocked; don’t rely on it.

### User decisions already locked

| Topic | Decision |
|---|---|
| Copilot | Renamed **Love**. **Not** a 5th tab. Bottom bar is 4 icons: Home / joystick (Control) / chat / profile. Love is a **floating pill overlay**. |
| Love pill | **Minimize / restore affordance**, not a permanent Home widget. Show on Home/Control/etc. **only when a Love session is minimized**. Fully exit Love/Sync → hide pill. |
| Message board | Use newer Figma `5736:20680`. Scope: inbox, search, chat, Listen TTS, voice call, sidebar, add contact, bot settings, Premium, regenerate, voice bars. |
| Listen | **TTS (text-to-speech)**, not microphone. Stub + WebView speech in `src/services/tts.ts` + `src/services/TtsHost.tsx`. Real TTS API later via `configureTtsEngine()`. |
| Video call | **None.** Voice only. |
| Chat data | Local mock (Kevin / Chad / Amanda). No GraphQL chat API. |
| Launch | Not shipping. Must run complete on one phone. |
| 3D beauty | **Ignore polish** (user, 2026-08-24). Options must work; demo presentable. |
| 3D gender | **Male-only.** Only `bozo-male.glb` exists. Female / Non-binary disabled with “Demo: male avatar only for now”. Do not pretend gender swaps the model. |
| Real BLE / toy hardware | **Ignore for now** (user, 2026-08-24). Use **fake Bluetooth**. |
| LLM | User wants a real OpenAI-compatible API, “just add a key.” Service exists; **Love/Message UI still uses local scripted replies** until wired. |
| Companion Sync | Love chat or Message thread already has a person. Sync **starts with that person** (Love SYNC overlay). No picker. Control Sync has no person, so the selection stack is OK. |
| Control Auto | **Toggle in place** on the hub. Rotating ring while on. Do **not** push `auto.tsx` as the primary tap. |

---

## 2. How to run

```bash
cd /Users/maxwell/Downloads/ph-app2.0-frontend-main
npm install          # postinstall runs pod install
npm start            # Metro 8081; also starts avatar static server via metro.config.js
npm run ios          # or Xcode; bundle id org.reactjs.native.pleasurehouse.--PLEASUREHOUSE2-rfc1034identifier-
```

- Boot splash: `OpenAnimationScreen` in `App.tsx` (~1.6s + `AsyncStorage` `user`).
- Fast path into the app: Login → **Bypass login**.
- iPhone 15 Simulator UDID used in past sessions: `D4A6B178-D63E-41F3-8E7D-E7E966E3CF46` (may have changed).
- Avatar 3D: Metro serves `http://<metro-host>:8081/ph-avatar/viewer.html`. `metro.config.js` also starts `scripts/avatar-static-server.js` (port **8099**). Preview WebView uses the **Metro URL** from `SourceCode.scriptURL`. **Physical iPhone:** same Wi‑Fi as the Mac running `npm start`. In Safari on the phone, open `http://<mac-lan-ip>:8081/ph-avatar/viewer.html` — if that fails, the in-app preview will fail too (error + Retry). USB-only without that host reachable is not enough. GLB is **not** bundled in the app binary.

### Env / secrets

- `.env` is gitignored. **Do not commit it.** It has AWS keys.
- `.env.example` is a stub (`BACKEND_URL`, dummy AWS).
- GraphQL default in `src/apolloClient.js`: `https://o31edlh788.execute-api.us-east-1.amazonaws.com/`
- Babel `react-native-dotenv` → `@env` (`babel.config.js`). `allowUndefined: false` — empty keys must still exist in `.env` if you add new names.
- LLM key: `src/services/llm-config.ts` reads `@env` `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`, overlay AsyncStorage `ph.llm.v1`. **No Profile UI to paste a key yet.**

---

## 3. App architecture (start here in code)

```
App.tsx
  ApolloProvider (src/apolloClient.js)
    GlobalProvider (src/store)
      AppProvider (kink context)
        DeviceProvider          ← fake BLE   src/store/device.tsx
          HomeScreenProvider    ← motor/BLE  src/hooks/HomeScreenContext.js
            CompanionsProvider  ← avatars    src/store/companions.tsx
              LoveSessionProvider            src/screens/love/session.tsx
                ChatProvider                 src/screens/chat/store.tsx
                  TtsHost                    src/services/TtsHost.tsx
                  NavigationContainer
                    AUTH | MAIN | ONBOARDING
```

**MAIN** = `navigations/home-stack.tsx` (`HomeStack`).  
First screen: `SCREENS.NAV_BAR` = 4 tabs in `src/common/components/nav-bar/nav-bar.tsx`.

| Tab | Screen constant | Code |
|---|---|---|
| Home | `SCREENS.HOME` | `src/screens/home/index.tsx` |
| Control (joystick) | `SCREENS.CONTROL` | `src/screens/control/index.tsx` |
| Message | `SCREENS.CHAT` | `src/screens/chat/index.tsx` |
| Profile | `SCREENS.PROFILE` | `src/screens/profile/ProfileStack.tsx` |

Screen name constants: **`src/common/constant/index.ts`** (`SCREENS`). Always add routes there **and** in the relevant stack.

Love is **not** a tab. Open via companion avatars on Home, avatar wizard finish, or the **global** `SessionLovePill` when minimized. The pill is mounted once on `HomeStack` (`GlobalSessionLovePill`), not per screen.

---

## 4. File map (where to look)

### Navigation

| File | What |
|---|---|
| `App.tsx` | Root providers + AUTH/MAIN/ONBOARDING |
| `navigations/auth-stack.tsx` | Login, register, forgot password |
| `navigations/onboarding-stack.tsx` | Pairing / onboarding |
| `navigations/home-stack.tsx` | Almost all logged-in screens + Love/Chat modals |
| `navigations/playground-stack.tsx` | Bliss, Deep Discovery, Sound, Motion, Alarm, Canvas |
| `src/common/components/nav-bar/nav-bar.tsx` | 4 tabs |

### Love (overlay session)

| File | What |
|---|---|
| `src/screens/love/session.tsx` | Session store: `layer` chat/call/sync, `minimized`, `chat` messages/flags, `start` / `patchChat` / `minimize` / `restore` / `end` |
| `src/screens/love/pill.tsx` | `LovePill` (always-on chrome **on Love overlays** = minimize). `SessionLovePill` = **only if minimized**. `useOpenLove()` |
| `src/screens/love/overlay.ts` | `dismissLoveOverlays(nav, then?)` / `restoreLoveOverlays` — required when leaving Love to Pattern/Kink/Bliss |
| `src/screens/love/stack.ts` | Pure Home-stack shape for a Love layer. `LoveStackSurface` = where the session was entered: `love` (dark LoveChat underneath), `message` (Message `ChatThread` underneath), `control` (Control hub Sync card; nothing underneath). Locked by `__tests__/love-sync-stack.test.ts` + `control-sync-navigation.test.tsx` |
| `src/screens/love/chat.tsx` | Love chat UI + plus drawer (Sync/Call/Pin/Listen, Pattern/Kink/Bliss) |
| `src/screens/love/call.tsx` | Voice call overlay. Minimize = pill; hangup = end call, back to chat |
| `src/screens/love/sync.tsx` | Sync overlay. Same minimize vs hangup split |
| `src/screens/love/types.ts` | `LoveLayer`, `LoveMode`, message types |
| `src/screens/love/replies.ts` | Local scripted companion replies (`companionReply`) |

**Pill product logic (do not regress):**

- Minimized Love shows **one global** `SessionLovePill` overlay on `HomeStack` (all tabs + deep screens). `SessionLovePill` returns null unless `minimized`. Never always-on LovePill on Home.
- Love overlay chrome still uses bare `LovePill` (chat side pill / Call&Sync minimize).
- Header back on Love chat = **end session** (no pill). `end()` also clears `companionId` and Call/Sync timers.
- Side pill on Love chat / minimize icon on Call&Sync = **minimize**. Hangup X ends that layer, **not** minimize.
- Call/Sync elapsed time lives in `LoveSessionProvider` (`callStartedAt` / `syncStartedAt`) so minimize → restore does not reset to 00:00.
- Control → Kink opens the Hardcore/Gentle **hub** (`SCREENS.KINK_HUB`). Generate on the hub still enters the wizard (`SCREENS.KINK`).

### Message tab

| File | What |
|---|---|
| `src/screens/chat/store.tsx` | Threads, send, listen, call flag, persist `ph.chat.v1` |
| `src/screens/chat/types.ts` | Thread/bubble types |
| `src/screens/chat/index.tsx` | Inbox |
| `src/screens/chat/thread.tsx` | Thread + drawer |
| `src/screens/chat/call.tsx` | Voice call. Minimize keeps `inCall`; hangup clears it |
| `src/screens/chat/search.tsx` `create.tsx` `contact.tsx` `settings.tsx` | Search, create bot, contact, settings |

Bots reply with `companionReply` today. `completeCompanionChat` in `src/services/llm.ts` is ready but **not called** from store/Love chat.

### Avatar / companions

| File | What |
|---|---|
| `src/screens/avatar/stack.tsx` | Wizard |
| `src/screens/avatar/identity.tsx` … `intimate.tsx` `candle.tsx` `waiting.tsx` | Steps. `waiting.tsx` saves companion then `CommonActions.reset` to `LOVE_CHAT` |
| `src/screens/avatar/context.tsx` | Draft |
| `src/screens/avatar/engine/AvatarPreview.tsx` | WebView → Metro `/ph-avatar/viewer.html` |
| `src/screens/avatar/engine/viewer-html.ts` | Look types / presets |
| `assets/avatar-engine/` | `viewer-page.html`, three, GLTFLoader, `bozo-male.glb` |
| `src/store/companions.tsx` | In-memory + persist `ph.companions.v1` |

### Device / Control / Pattern / Kink / Playground

| File | What |
|---|---|
| `src/store/device.tsx` | Fake BLE: `DEMO_DEVICE_ID` `ph-demo`, name **Pleasure House**, persist `ph.device.v1` |
| `src/store/toy.ts` | Phone `Vibration` stand-in for motor (`applyToyMotor` / `stopToy`) |
| `src/hooks/HomeScreenContext.js` | `isConnected = ble \|\| demo`. `motorInput` → toy if demo, else `writeToMotor`. **Starting a mode auto-connects demo** if nothing connected |
| `src/hooks/useBleManager.ts` | Real `react-native-ble-manager` (unused for demo) |
| `src/screens/onboarding/ConnectDevice/index.tsx` | Device list; **demo row first**, then real scan |
| `src/common/components/connection-pill/` | Connected/Disconnected; tap → `CONNECT_DEVICE` |
| `src/screens/control/index.tsx` | Hub: Auto, Playground, Pattern, Manual, Kink, Sync. **Auto tap toggles** (ring + motor). Kink → `KINK_HUB` (`control/sub-screens/kink`), then Generate → wizard |
| `src/screens/control/auto.tsx` | Leftover color-wheel screen — not the primary Auto action |
| `src/screens/control/sub-screens/manual/` | Slider + play; `setMotorInput([1, level, level, level])` |
| `src/screens/control/sub-screens/pattern/` | Library |
| `src/store/patterns.ts` | `BUILTIN_PATTERNS`, `wavePattern`, `nextNamedPattern` |
| `src/hooks/usePatternPlayer.ts` | Interval player used by Kink player |
| `.../play-pattern/` | Play UI; graph already pushes motor while `start` |
| `src/screens/kink/` | Wizard stack; `kink-player-screen.tsx` uses `usePatternPlayer` |
| `src/screens/quick_bliss/` | Timer; still mostly UI |
| `src/screens/playground/` | Hub into Bliss / Discovery / Canvas / Sound / Motion / Alarm |
| `src/screens/home/performance.tsx` `performance-play.tsx` | Performance list/play |
| `src/screens/sync/` | Partner sync stack (Control card). Separate from Love Sync modal |

### Auth / profile / TTS / LLM

| File | What |
|---|---|
| `src/screens/auth/open-animation.tsx` | Splash |
| `src/screens/auth/login/` | Login + bypass |
| `src/screens/auth/resetpassword/` | Forgot-password chain |
| `src/screens/profile/` | Menu, account, language, premium, tutorial, switch accounts |
| `src/services/tts.ts` | Engine interface |
| `src/services/TtsHost.tsx` | Hidden WebView `speechSynthesis` |
| `src/services/llm.ts` | OpenAI-compatible `POST {base}/chat/completions` |
| `src/services/llm-config.ts` | Key/base/model |

### Design tokens

- Colors: `src/common/styles/colors.ts`
- Fonts: `src/common/styles/fonts.ts`
- Spacing: `src/common/styles/spacings.ts`

---

## 5. What is actually working vs still fake

| Area | Status |
|---|---|
| Pages / navigation | Reachable. Some playground/onboarding screens are still thin. |
| Love overlay + pill | Session store. Minimize vs full exit. Do not put `LovePill` on Home unconditionally. |
| Love / Message chat | Send works. **Replies are local `companionReply`**, not LLM, until you wire `completeCompanionChat`. |
| Voice call UI | Timer / press / hangup. **No WebRTC.** |
| Listen | UI + `speechSynthesis` stand-in. |
| Avatar wizard | Works. Preview needs Metro. Companions persist. |
| Fake BLE | Connect **Pleasure House** on Find-device, or auto-connect when a control mode starts. Phone vibrates via `toy.ts`. |
| Manual / Auto / Pattern play / Kink play | Drive `setMotorInput` / `usePatternPlayer`. |
| Real toy BLE | Code in `useBleManager.ts` exists; **out of scope**. |
| LLM | Client ready. **No settings screen. Chat UIs not wired.** |
| Login | GraphQL + Google real; bypass for local. |
| Profile GraphQL | Works if backend is up; logout clears `user`. |

---

## 6. Landmines (bugs we already paid for)

1. **Transparent modal + non-modal push** = screen appears under Love. Fix: `dismissLoveOverlays` then navigate Pattern/Kink/Bliss. Same class of bug as Love → old `SYNC_STACK`.
2. **Home always showing Love pill** was wrong. Pill = minimized session only. Global overlay is the restore affordance; do not re-add per-screen pills.
3. **Love chat remounts** if you don’t keep messages in `LoveSessionProvider`. Don’t put Love transcript only in component `useState` if minimize/restore must keep it.
4. **`start()` on LoveChat mount** must `keepLayer` so restoring into Sync/Call doesn’t reset layer to chat.
5. Pattern play from Love must **minimize Love first**, then Pattern, so the pill is the way back.
6. Chat call `useEffect` cleanup used to `setInCall(null)` on minimize. Hangup vs minimize must use a ref (see `src/screens/chat/call.tsx`).
7. Figma Control tab *is* the color remote; current Control is a **6-card hub**. **Auto is a hub toggle** (ring + fake motor), not a full-screen push. `auto.tsx` color wheel is leftover advanced UI — do not make it the primary Auto tap.
8. Message/Love Sync with a known companion must open Love SYNC overlay bound to that person. Never dump the user on `SYNC_SELECTION_SCREEN` to pick again.
9. Control Sync minimize must **keep the session** (Love session + global pill). Red X ends Sync. Do not treat minimize as hangup.
10. **Never `require("@env")` at runtime** (not even inside `try/catch`). `react-native-dotenv` only rewrites `import` declarations. Metro 0.80 treats a `require` inside `try` as optional, drops the unresolvable dependency from the module's `_dependencyMap`, and keeps the baked indices, so a later `require()` in that file becomes `require(undefined)` → the Metro runtime reports it via `ErrorUtils.reportFatalError` → `RCTFatal` in Release. This killed TestFlight 1.2 (3)–(6) on the first `loadLlmConfig()` (chat send, Profile → Companion AI). Maxwell had already hit it in `0cbd091` and worked around it in `5cd2912`; PR #5 reintroduced it. Use `import { LLM_API_KEY } from "@env"`; `__tests__/metro-release-bundle.test.ts` guards every project module.
11. **Release JS errors are process kills.** An uncaught JS exception in a Release IPA is `RCTFatal` → `abort()`, indistinguishable from a native crash on the phone. `src/services/crash-guard.tsx` (installed in `index.js`, boundary + banner in `App.tsx`) now keeps the process alive and shows the message; if a build still quits with no banner, the cause is native and needs the Xcode Organizer log.
12. **Record the real origin `surface` whenever `start()` opens Call/Sync.** `surface: "love"` means "a dark LoveChat belongs under this overlay", so pill restore rebuilds `NavBar → LoveChat → LoveSync` and red X (`goBack`) lands on that LoveChat. The Control hub Sync (`src/screens/sync/sync_screen.tsx`, Maxwell calls this tab "Playground") recorded `love` on minimize; on TestFlight 1.2 (8) that showed as a dark-chat flash on pill restore and X dumping him on a chat he never opened. Control Sync is `surface: "control"`: restore is `NavBar → LoveSync`, X is `end()` + `dismissLoveOverlays` back onto the hub. Only Love chat's own `+ → Sync/Call` may use `love`.
13. **Check stacked PR branches actually contain the fixes you think they do.** `cursor/persist-kink-favorites-b118` (#19) was cut from an older #6 commit and never had `e9cb6f1` (TtsHost WKWebView removal), #12 (avatar WKWebView only for a focused slot) or #17. `git merge-base --is-ancestor <fix-sha> HEAD` before building a TestFlight from a stack tip.

---

## 7. Next work (priority the user already stated)

Overnight QA close-out (global Love pill, dead taps, Control→Kink hub, fake tabs, Profile/Sync/Switch-account copy, tab focus, Call/Sync timer persist, `end()` clears companionId) is done.

### Avatar / companion lifecycle (2026-08-24)

Treat **Create → Save → Edit look → Edit persona → Save again** as one product. Same `companionId`. `upsertCompanion` never clones.

- **Create wizard** (`mode: create`): Identity → Ready → Appearance → Customize → Personality → Story → Intimate → Candle → Waiting. Back = previous step; close = discard if dirty. Each step says 3D vs chat persona. Male-only 3D.
- **First save:** Waiting upserts companion + matching Message thread immediately, blocks system back, then opens Love. Home strip + Love header/pill use `LookFace`.
- **Edit look** (`mode: editLook`): Appearance → Customize → **Save look**. Loads existing look. Cancel restores baseline.
- **Edit persona** (`mode: editPersona`): Identity → Personality → Story → Intimate → **Save persona**. Does not open the full new-avatar wizard.
- **Entry:** Love `···` → Edit avatar / Edit persona (dismisses Love overlay first). Chat settings: same if a companion exists; otherwise Edit traits (`create.tsx`) or Create avatar (wizard with that thread id).
- Preview Metro path unchanged. Outfit cards still do not wipe Customize.

Do not regress SessionLovePill / Sync / Auto.

Remaining product work:

1. **Wire LLM into Love + Message**  
   - `src/screens/love/chat.tsx` `send`  
   - `src/screens/chat/store.tsx` `sendText` / regenerate  
   Call `completeCompanionChat` from `src/services/llm.ts`. Fall back to `companionReply` if no key / fetch fail.  
   Add a Profile row “Companion AI” to paste API key, base URL, model (`saveLlmConfig`). OpenAI-compatible (OpenAI / Groq / OpenRouter).
2. **Keep fake BLE; finish leftover play surfaces** that still don’t call `setMotorInput`: Bliss timer, Deep Discovery timer, Sound meter, Canvas pan, Motion (partial), Alarm, Performance-play prev/next.
3. **Do not** sculpt a female GLB or polish 3D beauty. **Do not** implement real toy BLE unless asked.
4. Optional later: bundle GLB for offline phone; real WebRTC; real LLM streaming.

---

## 8. Conventions for new code

- Screens: `src/screens/<area>/`. Navigation names in `SCREENS`.
- No inline imports (workspace rule). Exhaustive `switch` with `never` default (workspace rule).
- Imports at top of file.
- Scale with `s()` for UI 2.0 screens.
- Persist user-visible local data in AsyncStorage with `ph.*` keys.
- Don’t commit `.env`, `node_modules`, `ios/Pods`, `pleasurehouseenv/`.

---

## 9. Figma MCP reminder

- URL pattern: `figma.com/design/:fileKey/:name?node-id=3005-5377` → nodeId `3005:5377`.
- Load `/figma-design-to-code` skill before `get_design_context`.
- Adapt output to this RN codebase; it is a reference, not paste-ready code.

---

## 10. Git / GitHub

**Repo (public):** https://github.com/chensxmaxwell/ph-app2.0-frontend

Local `main` matches this remote. **`.env` is not in git.** `node_modules` and `ios/Pods` are not in git.

Clone elsewhere:

```bash
git clone https://github.com/chensxmaxwell/ph-app2.0-frontend.git
cd ph-app2.0-frontend
cp /path/to/your/.env .env   # never commit this
npm install
npm run ios
```

Public is OK for this tree: no real AWS/LLM keys in git. `.env.example` only has dummy values. Do not later commit `.env` or a real `LLM_API_KEY`.
