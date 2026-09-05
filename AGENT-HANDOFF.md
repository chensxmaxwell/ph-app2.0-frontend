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
| 3D gender | **Gender is selectable, the 3D body is not.** Male / Female / Non-binary all save (companion + thread `gender`); only `bozo-male.glb` exists and the Identity page says "3D appearance is the current body for every gender." Gender only filters the portrait tiles. Do not pretend gender swaps the model, and do not grey the options out again (Maxwell, TestFlight 1.2 (13)). |
| Avatar (face) | Picked **in the create wizard** (Identity page "Choose avatar": 3D avatar being crafted, the six bundled portraits for the gender, a seeded person's photo) — required before Continue. Chat settings keeps a secondary switch; Love `···` has none. |
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
- Avatar 3D: Metro serves `http://<metro-host>:8081/ph-avatar/viewer.html`. `metro.config.js` also starts `scripts/avatar-static-server.js` (port **8099**). Preview WebView uses the **Metro URL** from `SourceCode.scriptURL`. **Physical iPhone:** same Wi‑Fi as the Mac running `npm start`. In Safari on the phone, open `http://<mac-lan-ip>:8081/ph-avatar/viewer.html` — if that fails, the in-app preview will fail too (error + Retry). USB-only without that host reachable is not enough. That is the **Debug** path only: Release / TestFlight builds load `file://` copies of `viewer-page.html`, `three.min.js`, `GLTFLoader.js` and `bozo-male.glb` from the app bundle (`ios/AppFrontend/avatar-engine/`, flat Xcode resources; `PHNative.avatarViewerUrl`), so a TestFlight 3D bug is whatever is in those copies — keep them identical to `assets/avatar-engine/`.

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
| `src/screens/chat/store.tsx` | Threads, send, listen, call flag, `setUnread`, `deleteThread`, persist `ph.chat.v2` (`threads`, `isPremium`, `deletedThreadIds`). Every send / reply / request stamps `sentAt` on the bubble and `lastActivityAt` on the thread with `Date.now()`; persona edits (`updateBot`, existing-companion `upsertCompanionThread`) do **not** bump the time |
| `src/screens/chat/types.ts` | Thread/bubble types (`unread?` is the only read/unread state). `ChatBubble.sentAt` / `ChatThread.lastActivityAt` are epoch ms — there is no stored display string |
| `src/screens/chat/time.ts` | The only chat time formatter. WeChat buckets in English, device-local time: `now` (<1 min) → `3 min ago` (<60 min) → `2:14 PM` (today) → `Yesterday` → `Mon` (2–6 days) → `Sep 2` → `Sep 2, 2025`. `formatChatListTime` (inbox row), `formatChatThreadTime` (adds the clock: `Yesterday 2:14 PM`, `Sep 2, 2:14 PM`), `showsTimeSeparator` (first bubble + every ≥5 min gap) |
| `src/screens/chat/use-now.ts` | `useNow()` — 30 s tick + refresh on `AppState` active, so `now` becomes `3 min ago` without leaving the screen or relaunching |
| `src/screens/chat/index.tsx` | Inbox. Rows = `messageFriends(threads)` from `./friends.ts` (the one membership + order rule Home reuses). Row time = `formatChatListTime(thread.lastActivityAt, now)`. Swipe a row **left** (WeChat layout) → gray **Mark unread**, red **Delete friend**. Delete always double-checks via `Dialog`; confirm removes the thread and tombstones the id, which also drops the person from Home My Companions (the 3D companion record, if any, is left as orphan data and never listed). Labels live in `SWIPE_LABELS` (Maxwell's words: 消息未读 / 删除好友) |
| `src/screens/chat/friends.ts` | `isMessageFriend` / `messageFriends` — who counts as a Message friend (`request !== "refused"`, pinned first). Change membership here and only here; Home follows |
| `src/screens/chat/person.ts` | One person = one thread + (optionally) one 3D companion record. `defaultBotIdForName` (Kevin/Chad/Amanda fold), `threadIdForCompanion`, `companionForThread`, `threadForCompanion`, `findPerson(id, threads, companions)` — resolves **either** id to the pair. Every lookup that starts from a person id goes through here, never a bare `find(item => item.id === id)` |
| `src/screens/chat/faces.ts` | `portraitPresetForId` (the photo a **seeded** person owns; null for everyone else) and `faceSourceForId` (last-resort stock image). Screens do not call these directly anymore — `companionFace` does |
| `src/screens/chat/thread.tsx` | Thread + drawer. Header and empty-state hero draw `usePersonFace(threadId)`. WeChat-style time line above the first bubble and after every 5-minute gap (`message-time-<bubbleId>`), not a time per bubble. Mounting it clears `unread` — opening a chat is the only "mark read" |
| `src/backend/chat-seed.ts` | Seeded Kevin / Chad / Amanda with **relative past** times: Amanda 2 h ago, Chad yesterday 2:14 PM, Kevin three nights ago ~11:50 PM. `seedThreads(now)` takes the clock so tests can pin it |
| `src/backend/chat-timestamps.ts` | One-time recovery for blobs written before `sentAt` existed (`time: "Now"` strings, unstamped bubbles). Reads the epoch back out of ids (`${Date.now()}-hex`, `msg-<base36>-hex`), gives seeded bubbles their seed time, copies a neighbour for the rest. `loadChat` runs it and writes the migrated blob back |
| `src/screens/chat/dialog.tsx` | Shared in-screen confirm (thread Leave / Listen-blocked, inbox Delete friend) |
| `src/screens/chat/call.tsx` | Voice call. Minimize keeps `inCall`; hangup clears it |
| `src/screens/chat/search.tsx` `contact.tsx` `settings.tsx` | Search, contact, settings. Settings (thread header lightbulb) hosts the **avatar picker** (`AvatarPicker`, shown only when the person has ≥2 faces: crafted look + own photo) and finds the 3D record through `findPerson`, so a folded Kevin gets Edit avatar, not Create avatar. **No create form here**: Message `+` → Create new opens the avatar wizard (`openCreateCompanion` in `src/screens/avatar/open.ts`) |

Bots reply with `companionReply` today. `completeCompanionChat` in `src/services/llm.ts` is ready but **not called** from store/Love chat.

### Avatar / companions

| File | What |
|---|---|
| `src/screens/avatar/stack.tsx` | Wizard |
| `src/screens/avatar/identity.tsx` … `intimate.tsx` `candle.tsx` `waiting.tsx` | Steps. `identity.tsx` is the **basic info page** (name, gender, **Choose avatar grid**, birthday, description); every gender is selectable (`GENDER_NOTE`), and in `create` mode Continue stays locked until an avatar tile is picked (`draft.avatar`). `waiting.tsx` saves companion then `CommonActions.reset` to `NAV_BAR → CHAT_THREAD { threadId }` (`routesAfterCompanionSaved`) — the person's real Message thread with Home underneath; it does **not** start a Love session or open `LOVE_CHAT` |
| `src/screens/avatar/portraits.ts` | The six bundled portraits (`PORTRAIT_IDS` m-warm, m-calm, f-bangs, f-long, nb-short, m-tousled → `assets/images/avatars/portrait-<id>.png`), `portraitsForGender` (Male → m-*, Female → f-*, else all six), `portraitById`. `__tests__/avatar-portraits.test.ts` guards that the files are the attached portraits (square, ≥ 256 px, six distinct) |
| `src/screens/avatar/face.ts` | `CompanionFace` (`kind`, `look`, `source`) — the one face a person shows everywhere. `companionFace({ thread, companion, id, kind, choice, gender })`: a bundled portrait id in the thread's `avatar` wins outright; else the crafted look unless the pick is `portrait` **and** the person owns a photo; no look → photo → stock. `avatarOptions` lists what can be picked (look if a record, photo if owned, portraits for the gender, plus the current pick). Render with `<LookFace look={face.look} fallbackSource={face.source} />` |
| `src/screens/avatar/use-person-face.ts` | `usePersonFace(id, kind?)` → `{ face, options, choose }` for one person from either id; `useFaceResolver()` → `(id, kind?) => CompanionFace` for lists. Used by Home, Message list/thread/call/search, Love chat/pill/call/sync, Control Sync + picker |
| `src/screens/avatar/avatar-picker.tsx` | Wrapping grid of pickable faces (`avatar-option-look` / `avatar-option-portrait` / `avatar-option-<portraitId>`), ringed selection, `selected` may be `null` (create wizard before a pick) |
| `src/screens/avatar/use-save-companion.ts` | The one save path. `create` folds a seeded name onto the seed id (a new 3D "Kevin" is record **and** thread `kevin`) and writes the wizard's avatar pick to the thread; editLook sets the pick back to `look`; editPersona writes the pick (record or chat-only bot) |
| `src/screens/avatar/open.ts` | `openCreateCompanion` (Home `+`, Message `+`), `openEditPersona`, `openAvatarWizard` |
| `src/screens/avatar/birthday.ts` | The only birthday rules: `formatBirthdayInput` (auto `/`), `isPlausibleBirthday` (empty OK, else real mm/dd/yyyy date) |
| `src/screens/avatar/context.tsx` | Draft |
| `src/screens/avatar/engine/AvatarPreview.tsx` | WebView → Metro `/ph-avatar/viewer.html` |
| `src/screens/avatar/engine/viewer-html.ts` | Look types / presets |
| `assets/avatar-engine/` | `viewer-page.html`, three r128, GLTFLoader, `bozo-male.glb`. **The source of truth for the 3D viewer.** `ios/AppFrontend/avatar-engine/` and `android/app/src/main/assets/avatar-engine/` are byte copies bundled into Release; `__tests__/avatar-viewer-rig.test.ts` fails if they drift — `cp` after every edit |
| `assets/avatar-engine/viewer-page.html` internals | `figureMeshVisible` (which Body_/Head_/Eyes_/Hair_/Outfit_ meshes a look draws, `SKIN_BY_OUTFIT` = skin each outfit leaves bare), `retargetSkeletons` (23 armatures → one master skeleton by glTF bone name), `placeFigure`/`measureFigureBox` (skinned bbox via `boneTransform`), `OUTFIT_POSES` + `poseArm` (two-bone IK: wrist target + elbow pole per side, metres from the shoulder joint), the eye block: `IRIS_RADIUS` 0.31 / `PUPIL_RADIUS` 0.115 + `irisFragmentChunk` (the eyeball GLSL; radii in the shader's normalised units where d = angle from the iris axis / 90° — measured exact on the GLB's UVs, so 0.31 is a 27.9° iris, the real iris-to-eyeball proportion; the rest lids uncover 0.26 above / 0.35 below / 0.40 nose / 0.66 temple), the **Eyes Size look model** — one slider, three couplings, all in `applyLook`: `eyeScaleFor` (`EYE_SCALE_MIN` 0.64 → `EYE_SCALE_MAX` 0.88, uniform scale on the two `eyeRoot` bones via `applyEyeScale`; `EYE_SCALE` 0.76 is the Size 0.5 default — #36's 0.58 read as too small on the craft walk, #40's 0.65 and 0.72 passes still too small on review), `upperLidDrop` (Head_0 `Shape_EyeLidHeight` `UPPER_LID_DROP` 0.29 at Size 0 → `UPPER_LID_DROP_LARGE` 0.21 at Size 1, heavier for small eyes; the lid reaches the pupil at ~0.34) and `irisSizeFor` (`IRIS_SIZE_SMALL` 1.10 → `IRIS_SIZE_LARGE` 1.0, the painted iris share, biggest for small eyes), plus `browMorphs` (RaiseBrows 0 → 0.03, LowerBrows settle 0.12 → 0 with Size); `CATCHLIGHT` + `viewSpaceEyeCentres` / `updateEyeCentres` (the highlight is a ≤9° spot on the analytic sphere normal from the per-frame `eyeCentreL/R` view-space uniforms, 80% white); the iris material's `polygonOffsetFactor` is **0** (constant `units` −4 only — a slope factor let the eyeball rim through the lids, see landmine 20); `MAX_GAZE_ANGLE` + `aimBoneAt` / `aimEyes` (every frame, both `eyeRoot_l/r` bones turn their local +Z onto `camera.position`; the lid margins are skinned 1.0 to those bones, so the lids turn with the gaze). `window.phViewerState()` (`.eyes` = lid weight + per-eye position / forward / `offCameraDeg` / `screen` = canvas px + px-per-metre at the eye's depth) and `window.phViewerRig` are read-only probes for tests. Metro cache-bust query lives in `AvatarEngineHost.tsx` (`?v=bozo34`); bump it with every viewer edit |
| `scripts/check-avatar-viewer.js` | Renders the real viewer in headless Chrome and asserts figure/hands in frame, eyeballs in the head, both irises aimed at the camera and converged, upper lid lowered, hair on the head, one master rig; writes screenshots plus a 4× `*-eyes.png` close-up per look. A second **pixel pass** (hoodie preset, Size 0 / 0.5 / 1, Outfit full-body and Eyes bust cameras, 3× CSS size, the rAF loop parked so the idle sway cannot move the eye between probe and capture) reads the eye pixels back and asserts iris exposure and sclera share per Size, the lid off the pupil, **full = bust** within noise, and that the default eye is **not a pinprick** at either camera (analytic iris ≥ 6.55 CSS px across in full and ≥ 16.6 px in bust — above the rejected 0.72 pass so a slide back fails; the counted opening ≥ 36 CSS px² in full only guards the 0.58 / 0.65 sizes because a 10 × 6 px blob moves ±2 px² with the parked idle-sway phase); it also writes the whole frame per Size and camera (`pixels-outfit2-<view>-size<n>-frame.png`) for review collages. `node scripts/check-avatar-viewer.js --out /tmp/ph-avatar-check` |
| `scripts/export-bozo-glb.py` | Blender 4.5 script that built `bozo-male.glb` from the BoZo FBX kit on Maxwell's Mac (not runnable here) |
| `src/store/companions.tsx` | In-memory + persist `ph.companions.v1`. Look / persona records only — it is **not** the list of who exists; Home reads that from the chat threads |
| `src/screens/home/companions.ts` | `homeCompanions(threads, companions)` / `useHomeCompanions()` — Home My Companions = `messageFriends(threads)`, each decorated with `companionFace(thread, companionForThread(thread))`. No Home-only catalog exists anymore |

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
| Love / Message chat | Send works. **Replies are local `companionReply`**, not LLM, until you wire `completeCompanionChat`. Message times are real epochs formatted WeChat-style (`now` / `3 min ago` / `2:14 PM` / `Yesterday` / `Mon` / `Sep 2`); Love chat shows no times. |
| Voice call UI | Timer / press / hangup. **No WebRTC.** |
| Listen | UI + `speechSynthesis` stand-in. |
| Avatar wizard | Works. Preview needs Metro in Debug; Release loads the bundled `ios/AppFrontend/avatar-engine` copy via `PHNative.avatarViewerUrl`. Companions persist. Blow the candle → Saving → the companion's **Message thread** with Home underneath (back = Home), not the dark Love overlay. 3D shows eyes, hands and four distinct arm poses (relaxed / arms crossed / hands on hips / wave); Maxwell confirmed eyes and hands on 1.2 (11). Iris shrunk from 0.58 to 0.40 for 1.2 (12) and he still called the eyes 恐怖; 1.2 (13) lowered the upper lid, converged both eyes on the camera and painted a 0.31 iris (landmine 20) and he still read the eyes as too big, so 1.2 (14) put `EYE_SCALE` 0.70 on the eye bones (whole eye 30% smaller, lids follow) and he still read them as a bit large with a Size slider that barely moved anything — PR #33 made the slider drive the bone scale itself (0.42 → 0.74). His next craft walk (Outfit full-body vs Eyes bust screenshots): a wide stare with sclera all round in full-body, a lid in bust, and Size min a pinprick. Root cause of the full/bust split was the iris material's slope-scaled `polygonOffsetFactor` letting the eyeball rim through the lids at small on-screen sizes (now 0); Size is now one look model — bone scale, lid 0.29 → 0.21, iris share 1.10 → 1.0, level brows, a ≤9° catchlight (landmine 20). His next craft walk (Outfit step, hoodie) read the #36 default (bone scale 0.58) as **too small**; PR #40 then moved the band to 0.52 → 0.78 (default 0.65) and 0.60 → 0.84 (default 0.72) and his review of each collage said **still too small, enlarge more**, so the band is now 0.64 → 0.88 (default 0.76) with the lid and iris curves untouched — headless Chrome only so far, not device-verified; **do not pack a TestFlight until Maxwell has approved the review collage.** |
| Home My Companions | Same people as the Message list (`homeCompanions`). Delete friend on Message removes them here too, across relaunch. Jest-verified in `__tests__/home-companions-membership.test.tsx`; not device-verified as of this entry. |
| Companion face | One face per person on Home, Message list, thread header/hero, Chat settings, Love chat header, Love pill, Love call, Love/Control Sync, Sync picker (`companionFace`). **Picked in the create wizard** (Identity page "Choose avatar": the 3D avatar, six bundled portraits filtered by gender, a seeded person's photo; required before Continue), persisted on the thread (`ph.chat.v2` `avatar`). Chat settings (thread lightbulb) keeps the same grid as a secondary switch; Edit persona reopens the Identity page with the current face ringed; Love `···` has no switch. Jest-verified in `__tests__/companion-avatar-identity.test.tsx` + `__tests__/create-character-entry.test.tsx`; not device-verified as of this entry. **The six PNGs under `assets/images/avatars/` are 64 px stand-ins** — the attached portraits never reached the agent VM; drop the real files in under the same names (`__tests__/avatar-portraits.test.ts` fails until then). |
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
14. **Never `require()` a stock portrait where a person is shown.** `assets/images/avatar-ring.png`, `assets/images/love/call-face.png` and `assets/images/message/kevin.png` are all Kevin. Control Sync (`src/screens/sync/sync_screen.tsx`, `SCREENS.SYNC_SCREEN`) rebound its header name to the picked person but kept `avatar-ring.png` for `SYNC_ACTIVE_CONFIRMATION` / `SYNC_ONGOING` — the state it boots into — so TestFlight 1.2 (9) showed Kevin's head for Chad and Amanda; `LoveSyncScreen` had the same `call-face.png` hard-code. Render the person through `usePersonFace(id)` / `companionFace(...)` (`<LookFace look={face.look} fallbackSource={face.source} />`); the stock image only ever reaches the screen through `CompanionFace.source`. `__tests__/sync-selected-person.test.tsx` fails on any Kevin portrait when someone else was picked; `__tests__/companion-avatar-identity.test.tsx` fails if a person-showing screen calls `faceSourceForId(` directly or requires `call-face.png` (the `love/call.tsx` `CALL_FACE` hard-code is gone).
15. **One create-character form, one birthday rule.** Home `+` opened the avatar wizard (`AvatarIdentityScreen`: validated mm/dd/yyyy, male-only gender, then 3D) while Message `+` → Create new opened `ChatCreateScreen` (`src/screens/chat/create.tsx`: free-text gender, unvalidated birthday, Save always on, no 3D, then a "Create avatar" success screen). Maxwell saw two similar-but-different pages on TestFlight 1.2. `ChatCreateScreen`, `SCREENS.CHAT_CREATE` and `createBot` are deleted; both `+` menus go through `openCreateCompanion`. Do not add a second "quick create" form — extend `identity.tsx` instead. `__tests__/create-character-entry.test.tsx` follows both `+` entries into the wizard and fails if they mount different first screens or apply different birthday rules. Stored birthdays that predate the rule (seeded Amanda: `13th April 2001`) show `Use mm/dd/yyyy` and block Continue until retyped; that is the rule working.
16. **Deleted seeded bots come back unless you tombstone them.** `mergeSeedThreads` re-inserts Kevin / Chad / Amanda on every hydrate and `loadChat` reseeds a blob whose `threads` is empty, so "Delete friend" on the inbox would have silently undone itself on the next launch. `deleteThread` records the id in `ChatBlob.deletedThreadIds`; `mergeSeedThreads` skips those seeds and `loadChat` treats an empty list with tombstones as real. Re-adding the same person (Add friends → `sendFriendRequest`) still works because an existing thread always wins over its tombstone. `__tests__/message-swipe-actions.test.tsx` relaunches the provider after deleting one and then all friends. Maxwell confirmed the swipe, Mark unread and Delete friend + confirm on TestFlight 1.2 (11).
17. **Never store a chat time as a display string.** `ChatThread.time` was a string that every send, reply, request change and persona save overwrote with `"Now"` (`src/screens/chat/store.tsx` ×8, `src/backend/store.ts` `appendMessage` / `upsertThread`, seeded Amanda in `src/backend/chat-seed.ts`), and the inbox row printed it verbatim — so Maxwell saw **now** on every chat forever. Bubbles carry `sentAt` and threads `lastActivityAt` (epoch ms, `Date.now()`); the label is computed at render by `src/screens/chat/time.ts` and re-rendered by `useNow()` (30 s tick + `AppState` active). Thread bubbles get WeChat time *lines* (first bubble, then ≥5 min gaps), not a time each. Editing a persona / look is not chat activity and must not bump `lastActivityAt`. Blobs from before the change hit `normalizeThreadTimestamps` in `loadChat`, which recovers real epochs from the ids the store already minted (`${Date.now()}-hex`) instead of stamping everything with the migration moment. Love chat (`src/screens/love/chat.tsx`) shows no times at all and was left alone. `__tests__/chat-time-format.test.ts` + `__tests__/message-timestamps.test.tsx` fail if a 2-hour-old message renders `now`, a send stores no timestamp, or a bucket boundary moves. Not device-verified as of this entry (Jest only).

18. **The 3D viewer's skinned meshes are not where `matrixWorld` says.** `bozo-male.glb` stores every mesh in armature space under a `root` node with a 90° + 0.01 transform, so `position * matrixWorld` lays BoZo on its side at 3 mm tall; the load-time bounding box clamped `modelHeight` to 0.8 and TestFlight showed shins in "full" and the crotch in "bust" (PR #10 hit the same thing). Measure with `SkinnedMesh.boneTransform` (`measureFigureBox`) — never raw positions. The same GLB has **23 armatures with duplicate bone names** (GLTFLoader renames them `hand_l`, `hand_l_1`, …; the glTF name is in `userData.name`) and three hair rigs (`Hair_0_0_0`, `Hair_1_1_0`, `Hair_3_1_0`) exported with a displaced pelvis that drew 1.4 m off the body; `retargetSkeletons` drives everything from one master skeleton. `Eyes_0` is the eyeball mesh — `applyVisibility` had `visible = false` on it since `d21a0f8`, so Maxwell saw blank sockets; `Head_0` also carries a closed-eye cap coincident with the eyeball, so the iris material needs `polygonOffset` or it z-fights skin speckles. `SKIN_BY_OUTFIT` had been cut to `{ Neck: 1 }` (`ea79b26`), which is why hands never rendered; list every bare part per garment. Arm poses are two-bone IK targets in `OUTFIT_POSES`, not hand-tuned Euler angles — the old table had the X sign inverted and folded the arms behind the back / into the hips. All of this is Jest-locked in `__tests__/avatar-viewer-rig.test.ts` and browser-checked by `scripts/check-avatar-viewer.js`; not device-verified as of this entry (headless Chrome + SwiftShader only). Known leftovers, out of scope: tank-top/shirt textures keep white ID-map regions (white collar band, grey chest patch), and the `Body_*` morphs grow under garments that have no morph targets (`Outfit_0_top` sleeves at max Muscle).

19. **Home My Companions must be the Message list, not a catalog of its own.** On TestFlight 1.2 (11) Kevin deleted from Message (landmine 16) still sat on Home, because `src/screens/home/hooks.ts` rendered a static `MOCK_HOME_COMPANIONS` (Kevin / Chad / Amanda) plus the 3D companion store and never read the chat threads or their tombstones. There is now one rule: `messageFriends(threads)` in `src/screens/chat/friends.ts` gives both screens their membership and order, and `homeCompanions` in `src/screens/home/companions.ts` only decorates each thread with the crafted look (by id, else by the store's seeded-name rule — a 3D "Kevin" folds into thread `kevin`, which used to draw two Kevins on Home). The mock catalog is deleted; do not add another per-screen people list (`src/screens/sync/sync_selection_screen.tsx` still has a hard-coded Kevin/Chad/Amanda `users` array for Control → Sync and is the remaining offender). Deleting a friend keeps their `ph.companions.v1` record as orphan data on purpose — Home never lists a record without a thread. `__tests__/home-companions-membership.test.tsx` deletes Kevin on Message and reads Home in the same render, after leaving the tab and after relaunch. Not device-verified as of this entry.

20. **Shrinking the iris cannot fix a startled eye; the BoZo lids, gaze and shader all had to move.** With `Eyes_0` drawn again (landmine 18) Maxwell reported "irises too large" on 1.2 (11) (`irisR = 0.58 * irisSize`, edge to edge, 0.26 pupil = black disc). 1.2 (12) shipped 0.40 / 0.17 and he called the eyes 恐怖 anyway: still wide open, staring past the camera, wall-eyed at close range. Measured on `bozo-male.glb` (`Eyes_0` is two 22.2 mm spheres centred on `eyeRoot_l/r`; the shader's `d` is angle-from-iris-axis / 90°): the rest lids uncover only −32°..+24° vertically (a 0.35 / 0.26 aperture, round and tall) and −36° (nose)..+59° (temple), so a 0.40 iris (36°) still spanned the whole height; the eyes pointed parallel along +Z while both cameras sit *below* eye level (bust 6.6°, full 9.4°), so the irises floated high with white under them and diverged from 1.7 m. Fix in `viewer-page.html`: `Shape_EyeLidHeight` on Head_0 (`UPPER_LID_DROP` 0.20 − 0.08·eyeSize; 1.0 drops the upper lid 15 mm, ~0.27 puts it on the pupil, 0.45 on the iris centre — do not go there), `aimEyes` turning both `eyeRoot` bones onto `camera.position` every frame (clamped by `MAX_GAZE_ANGLE`, reset from the stored rest quaternion so it never accumulates), `IRIS_RADIUS` 0.31 / `PUPIL_RADIUS` 0.115, an off-white sclera shaded under the upper lid, a hue-preserving iris gradient, view-space catchlights (the old UV-fixed ones mirrored between the eyes) and `envMapIntensity` 0.05 because the lavender env sky tinted the sclera steel blue. Head_0 also contains a skin-textured copy of both eyeballs (dished to 0.7 r at the iris, flush with the sphere at the rim) skinned to the same eye bones — it rotates with the gaze and stays behind the `polygonOffset` eyeball, so it is not the cause of anything visible. Not the cause either: eyeball scale/offset (the spheres sit exactly on the bones, inside the lid margins). `__tests__/avatar-viewer-rig.test.ts` locks the radius against the measured aperture, the lid-drop range and the gaze solver; `scripts/check-avatar-viewer.js` asserts `offCameraDeg` < 1.5° for both eyes, convergence, the lid weight, and writes `*-eyes.png` close-ups. Headless Chrome (SwiftShader) is still the only place any of this has been seen — walk Outfit → Hoodie (full) and Hair (bust) on the phone. **1.2 (13) follow-up: he still read the eyes as too big and asked for 整个眼睛的缩小, not another pupil change.** The eye *is* big: `Eyes_0` is 22.2 mm in radius (44 mm across on a 26 cm head; a real eye is 24 mm). The fix is `EYE_SCALE` 0.70 on the two `eyeRoot` bones (`applyEyeScale`, once after `retargetSkeletons`), not a mesh edit: the eyeball and Head_0's eye cap are skinned 1.0 to those bones and the lid margins 0.8–0.99, fading to ~0.3 at the lid crease and 0 by the brow (measured on the GLB), so linear-blend skinning shrinks ball, cap and lid opening together about the eye centre while brow and cheek stay — the rig's own weights are the falloff, and the 0.31 iris keeps its share of the smaller aperture. `aimBoneAt` writes the quaternion only, so the scale survives every frame. Do not shrink by editing `IRIS_RADIUS` again, and do not scale `Eyes_0` as a mesh (the cap and lids would not follow and the socket shows empty). `phViewerState().eyes.gaze.*.scale` reports it; `scripts/check-avatar-viewer.js` asserts the bone scale and that the `Eyes_0` box is 0.031 m tall (was 0.045). **1.2 (14) follow-up: "eyes still a bit large, Size adjustment change too small".** Measured in headless Chrome: the 0.70 was a constant applied once after `retargetSkeletons`, and the Eyes **Size** slider (`eyeSize`, the same draft key as the Face tab's "Eyes" slider) only rescaled the painted iris (`irisSize` 0.82..1.10), opened the lid 0.08 and nudged the brows — the eyeball stayed 0.70 at every position (`Eyes_0` 31.2 → 31.7 mm from min to max, a 1.5% change). Fix: `eyeScaleFor(eyeSize) = EYE_SCALE_MIN + eyeSize · (EYE_SCALE_MAX − EYE_SCALE_MIN)` with 0.42 / 0.74, applied to the eye bones on load **and in every `applyLook`** (absolute scale, so it is idempotent and `aimBoneAt` leaves it alone); `EYE_SCALE` now names the Size 0.5 default, 0.58 (a 25.8 mm eye; a real one is 24 mm). Rendered `Eyes_0`: Size 0 → 18.6 mm, default → 25.8 mm, Size 1 → 32.9 mm (1.76× min→max). `IRIS_RADIUS`, `PUPIL_RADIUS`, `UPPER_LID_DROP`, `MAX_GAZE_ANGLE` and `upperLidDrop` are untouched and locked by `__tests__/avatar-viewer-rig.test.ts`. Do not go under ~0.40 (the lid falloff stretches so thin the eye reads as a bare bead) or over ~0.80 (the 1.2 (11) saucer). Still not device-verified: walk Eyes → Size to both ends on the phone. **Craft-walk follow-up (Outfit full-body vs Eyes bust screenshots): "default stare too open, full vs bust lid coverage inconsistent, Size min a pinprick".** Three causes, all measured in headless Chrome on the render (eye pixels classified around the projected eye centre; `/tmp` scripts, not in the repo). (a) **The full/bust split was the iris material's `polygonOffsetFactor -2`, not the cameras or the lid morph.** `Shape_EyeLidHeight` was byte-identical in both views, and moving the bust camera to eye level changed the sclera share by <1 point. The slope-scaled offset grows with the polygon's per-pixel depth slope, which explodes at a sphere's grazing rim and is ~2.5× steeper when the ball is drawn smaller (4.6 m camera, small Size), so the eyeball's silhouette won the depth test against the lid skin *in front of it*: 45.5% sclera share in full vs 36.3% in bust for the same lid, arcs of white dots along the crease, and the "bare bead" at Size 0. Factor 0 (constant `units` −4 keeps the Head_0 eye cap behind the ball): 33.9% vs 33.7%. Do not put a slope factor back on the eyeball. (b) **The "bare bead" was never the lid falloff** — the lid margin is skinned **1.0** to the eye bones (measured), so the aperture scales with the ball; it was (a) plus a uniform-scale-only Size. (c) **The catchlight** was a `smoothstep(0.977, 0.992)` blob of the *interpolated* vertex normal on the 20-segment `Eyes_0` sphere, 92% white: it covered 15–49% of the visible iris and changed size between renders with the facet under it; on a 10 px full-body iris that is the top half painted sclera-white. It now uses the exact sphere normal (`fragPos − nearer eye centre`, view-space uniforms fed every frame by `updateEyeCentres`) with a ≤9° spot at 80%. The lid calibration (share of the iris height under the upper lid, iris 1.0): 0.16 → 3%, 0.20 → 9%, 0.24 → 14%, 0.28 → 20%, 0.32 → 28%, pupil at ~0.34 — the handoff's earlier "0.27 = pupil" came from a 15 mm morph estimate; the margin actually moves ~28 mm at 1.0. Iris share (lid 0.28): sclera share 38% at 0.90, 31% at 1.00, 24% at 1.10, 19% at 1.20; bone scale barely moves it. **Size is now one look model:** `eyeScaleFor` 0.46 / 0.58 / 0.70, `upperLidDrop` 0.29 / 0.25 / 0.21, `irisSizeFor` 1.10 / 1.05 / 1.00, `browMorphs` (RaiseBrows 0 / 0.015 / 0.03, LowerBrows settle 0.12 / 0.06 / 0). Rendered (hoodie preset, 4×): iris exposure 0.70 / 0.80 / 0.87, sclera share 22% / 26% / 31%, full = bust on every area metric (before: exposure 0.93–1.00, sclera 47–61% at Size 0, 45% vs 37% full/bust at default). `__tests__/avatar-viewer-rig.test.ts` locks the band, the lid range (never ≥ 0.31, never < 0.20), the iris share, the analytic catchlight and factor 0; `scripts/check-avatar-viewer.js` asserts the rendered bands and full/bust parity per Size (the pupil check runs in the bust view only — a 2.5 px pupil is not measurable). **Craft-walk follow-up on #36 (Outfit step, hoodie, full-body): "default eyes too small".** Measured on that build: at the Outfit camera the default (bone scale 0.58, a 25.8 mm real-proportion eye) draws a 5.1 CSS px iris in a 26 px² opening 4.3 px tall — the lid line and iris merge into one dark smudge under the fringe; in the bust it is a 13 px iris in a 21 × 11 px almond. The 1.2 (14) "0.70 a bit large" verdict that had anchored the default under 0.70 was an eye under the 0.16–0.20 stare lid *with* the polygon-offset sclera ring, neither of which exists anymore. Measured in headless Chrome with only `EYE_SCALE_MIN/MAX` varied (bands 0.46/0.70, 0.50/0.76, 0.52/0.78, 0.54/0.80, 0.56/0.84): iris exposure (0.80–0.83) and sclera share (0.31–0.33) at Size 0.5 do **not** move with the bone scale — the lid margin is skinned 1.0 to the eye bone, so the morph travel scales with the ball — while every px dimension scales linearly, so the whole band can move up and the lid / iris / brow curves stay exactly as #36 left them. #40's first pass chose **0.52 → 0.78, default 0.65** (28.9 mm; bust opening ~200 px², Outfit iris 5.8 px in a 32 px² opening) and Maxwell's review of that collage said **"still too small, enlarge more"** — two "too small" verdicts in a row, so the perceptual anchor is not the eyeball radius but the opening area, which grows with the square of the scale: 0.58 → 158 px², 0.65 → 198, 0.70 → 229, 0.72 → 243, 0.76 → 269, while the 1.2 (14) eye he called "a bit large" was ~280–300 px² *with* the stare lid and the sclera ring. Second sweep (bands 0.60/0.84, 0.58/0.84, 0.62/0.82, 0.59/0.85, 0.60/0.80, 0.64/0.88): iris exposure and sclera share again flat at every scale (Size 0.5 ≈ 0.81 / 0.32, Size 1 ≈ 0.88 / 0.36), so under the #36 lid the 1.2 (11) *sclera-dominant* saucer cannot come back at any scale — the only thing that grows is size. The second pass chose **0.60 → 0.84, default 0.72** (32.0 mm; bust opening ~243 px², Outfit iris 6.4 px in a 38 px² opening) and capped Size 1 at 0.84 because 0.88 *looked* like it crowded the brow in a comparison strip; Maxwell's review said **"still too small, enlarge more"** a second time. **Third pass — the brow-crowding claim was wrong, and is withdrawn.** Measured against the pupil found in the pixels (the idle-sway phase moves the head ~1.5 cm between parked renders, so the JSON eye centre from another frame is not a valid origin — use the pupil): the upper lid margin rises 3.3 → 5.0 → 6.7 → 7.7 px (1× bust) from 0.60 → 0.76 → 0.88 → 1.0 and the brow's underside shadow rises with it (27.7 → 30 → 31.3 → 32 px; the crease is part-weighted to the eye bone), so the **lid-to-brow gap is 24–25 px at every scale from 0.60 to 1.0**; the opening grows downward and outward because the gaze aims down at the camera, and fixed-frame crops at 0.86 / 0.88 / 0.92 / 1.0 show the brow gap unchanged. Even at 1.0 the resting lid keeps exposure 0.90 / sclera share 0.36. So neither the stare, the saucer nor brow crowding is a failure mode under the #36 lid; the one top-end guard left is the unscaled GLB eye itself (1.0 = the 1.2 (11)–(13) eye he asked to shrink). Chosen: **0.64 → 0.88, default 0.76** (33.7 mm; bust opening ~270 px², Outfit iris 6.7 px in a 41–43 px² opening 5.8 px tall — just under the 1.2 (14) stare's 280–300 px² with the iris top covered). Size 0 at 0.64 (28.4 mm) is about the first-pass default under the heaviest lid; Size 1 at 0.88 (39.1 mm) stays 12% under the GLB eye; the 0.24 spread is #36's original (`max / min` 1.375). Not chosen: a lighter default lid or a bigger default iris share (same reasons as before), 0.66/0.86 (the cap was only justified by the withdrawn brow claim; it narrows the slider to 1.30× for nothing). If he still reads 0.76 as small on the phone the next step is 0.80 (band 0.68/0.92, measured fine on every metric) — at that point the whole-eye is 36 mm and the question becomes whether the *head* proportion, not the eye, is what he is reacting to. `scripts/check-avatar-viewer.js` asserts the default is not a pinprick with the analytic iris thresholds above the rejected 0.72 pass (≥ 6.55 CSS px in full, ≥ 16.6 px in bust; the counted full opening ≥ 36 px² only guards 0.58 / 0.65 because it is ±2 px² noisy), the band, the 0.92 ceiling (`EYE_SCALE_CEILING`), and writes the per-Size frames. Still headless Chrome only: walk Outfit → Hoodie (full) and Eyes → Size to both ends (bust) on the phone — and Maxwell reviews the collage before any TestFlight pack.

21. **One person, two ids, three faces.** TestFlight 1.2 (12), Maxwell's three screenshots: finishing the 3D craft of a "Kevin" landed on a dark page with one bubble "Start chatting with Kevin." (他说“第一个是一个固定黑色页面”); Home drew the crafted cartoon; tapping it opened the blue Message thread wearing the **old Kevin photo** (“再点进去的头像竟然是以前的Kevin”). Three causes, one root. (a) `waiting.tsx` `start({ layer: "chat", surface: "love", fromCreation: true })` + `CommonActions.reset` to `LOVE_CHAT` — the dark Love overlay, whose `seedLoveChat({ fromCreation })` bubble is that text; it is a transient session, not the person's chat. (b) The Message thread header, Message rows, `chat/call.tsx`, `chat/search.tsx` resolved the face from the thread id alone via `faceSourceForId`, never looking at the companions store, while Home / Love / Sync looked the 3D record up — so the same person wore two faces. (c) A 3D companion named after a seed had record id `companion-<ts>` but thread id `kevin` (`findSameBot` / `dedupeThreads` fold); only Home paired them by name (`companionForThread`), so `ChatSettingsScreen`, `resolveLovePerson`, `AvatarStack` and the pill missed the record (settings even offered "Create avatar" for a Kevin that had one). Fixes: `findPerson` in `src/screens/chat/person.ts` is the only way to go from an id to `{ thread, companion }`; `companionFace` in `src/screens/avatar/face.ts` is the only face rule (crafted look unless the thread's `avatar` pick is `portrait` and the person owns a photo), rendered via `usePersonFace` / `useFaceResolver` on every surface; `useSaveCompanion` in `create` mode folds the record id onto the seed id (`threadIdForCompanion`) and `upsertCompanionThread` mints the thread under that id directly; `waiting.tsx` resets to `NAV_BAR → CHAT_THREAD { threadId }` and starts no Love session (a started-but-hidden session would have come back as a pill after relaunch). The avatar pick lives on `ChatThread.avatar` (thread = the one membership record; seeded people have no companion record; delete friend drops it). `__tests__/companion-avatar-identity.test.tsx` mounts Home + Message list + thread + Love chat + settings in the app's provider tree and fails if any surface disagrees, if the picker does not move all of them, if the Waiting step dispatches `LOVE_CHAT` or starts a session, or if the pick is lost on relaunch. Old records saved before the fold (`companion-<ts>` named Kevin) still pair by name. Not device-verified as of this entry; `seedLoveChat`'s `fromCreation` branch is now unreachable and left in place. **1.2 (13) follow-up: the picker was invisible** — it lived in Chat settings and only for people with two faces, so a freshly crafted companion had nothing to pick from and Maxwell could not find 选择头像. Product rule now: **the face is chosen while the character is created.** The Identity page has a "Choose avatar" grid (3D avatar about to be crafted, the six bundled portraits from `src/screens/avatar/portraits.ts` filtered by the chosen gender, a seeded person's own photo) and Continue is locked until a tile is picked; the pick rides on `AvatarDraft.avatar` and `useSaveCompanion` writes it to the thread. Chat settings keeps the grid as a secondary switch, Edit persona reopens the Identity page with the current face ringed, and the Love `···` "Use photo / Use 3D avatar" entries are gone (eight faces do not fit a dialog). Do not move the required picker back behind a post-create screen.
---

## 7. Next work (priority the user already stated)

Overnight QA close-out (global Love pill, dead taps, Control→Kink hub, fake tabs, Profile/Sync/Switch-account copy, tab focus, Call/Sync timer persist, `end()` clears companionId) is done.

### Avatar / companion lifecycle (2026-08-24)

Treat **Create → Save → Edit look → Edit persona → Save again** as one product. Same `companionId`. `upsertCompanion` never clones.

- **Create wizard** (`mode: create`): Identity (name, gender, **Choose avatar**, birthday, description) → Ready → Appearance → Customize → Personality → Intimate → Candle → Waiting. Back = previous step; close = discard if dirty. Each step says 3D vs chat persona. Any gender; one male 3D body. An avatar tile must be picked before Continue. Description *is* the persona `story`; there is no separate Story step.
- **First save:** Waiting upserts companion + matching Message thread immediately (same id for both — a seeded name folds onto the seed id), blocks system back, then resets to `NAV_BAR → CHAT_THREAD` for that person (back = Home). It does not open Love. Every surface draws `companionFace` with the face picked on the Identity page (3D look, bundled portrait, or a folded Kevin's seeded photo); Chat settings and Edit persona can switch it later.
- **Edit look** (`mode: editLook`): Appearance → Customize → **Save look**. Loads existing look. Cancel restores baseline.
- **Edit persona** (`mode: editPersona`): Identity → Personality → Intimate → **Save persona**. Does not open the full new-avatar wizard. On a **chat-only bot** (seeded Kevin / Amanda, no `Companion` record) the save writes the thread only (`updateBot`); it never mints a default-look companion. Untouched personality traits leave the seeded free-text `personality` alone.
- **Entry:** Home `+` and Message `+` → Create new both call `openCreateCompanion` → `AvatarStack { mode: "create" }`. Love `···` → Edit avatar / Edit persona (dismisses Love overlay first). Chat settings: Edit avatar / Edit persona if a companion exists; otherwise Edit persona (`openEditPersona`, same Identity form) or Create avatar (wizard with that thread id).
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
