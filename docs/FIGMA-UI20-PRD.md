# Pleasure House UI 2.0 — Screen Flow PRD

Source of truth: Figma file `PH-UIUX-v1.0`  
Page: **UI 2.0-front end (read me!)** (`3005:5377`)  
File: https://www.figma.com/design/5xgSMNYkdzAggSScwOn00A/PH-UIUX-v1.0?node-id=3005-5377  
Device canvas: **393 × 852 / 854** (iPhone 13 / 14 class)

This document maps Figma frames into app flows. Same-named frames in a section are usually **states of one screen**, not separate routes. Implementation must match Figma visually and follow these flows.

Out of scope unless you say otherwise: `UI 1.5`, `UI 2.0 (not me!)`, `iWatch`, `Web 2.0`, brand/logo pages.

---

## App map

```
Open-animation
    → Login
        → Sign Up / Register
        → Forgot password → Email-verification → new-password → confirmation → Login
        → Social (Google / Facebook / Apple)
        → Login success → Onboarding (if first time) OR Home

Onboarding
    Profile-setup → User-info → Info (permissions / intro)
        → Device pairing (手环 / 震动棒)
        → User feedback
        → Home

Home (bottom tabs)
    Home | Remote | Message | Love | Profile

Home hub
    → Performance / Pattern / Kink / Sync / Quick Bliss / Deep Discovery

Remote
    folded / unfolded color remote (device control)

Message
    inbox → chat (text / voice / regenerate) → drawer / add contact / bot settings
    → sync / voice call / premium overlays

Love
    Home variants + Performance + Sync-matched

Profile & settings
    Profile → language / account / email / password / device info

Avatar Creation
    Language-named wizard steps → Performance result

Pattern Creation
    Home → Pattern-default editor → Pattern save/play → Kink-play
```

---

## 1. Login & Onboarding (`3005:5378`)

| Screen | Figma node | States (same name) | Existing code |
|---|---|---|---|
| Login | `3005:5379` | 3 | `src/screens/auth/login` |
| Email-verification | `3005:5551` | 3 | register-otp / reset |
| email-verification-02 | `3005:5709` | 1 | |
| new-password | `3005:5867` | 2 | reset password |
| password-reset-confirmation | `3005:6025` | 2 | |
| email-reset-confirmation | `3005:6176` | 1 | |
| Open-animation | `3005:6629` | 1 | splash? |
| Profile-setup | `3005:6687` | 1 | `register-profile` |
| User-info | `3005:6772` | 1 | `register-bio` |
| Info | `3005:7334` | 4 | onboarding steps |
| Device-04 | `4176:16023` | 6 | `ConnectDevice` |
| User feedback | `4176:16418` | 6 | |
| 手环连app | `4176:16911` | 1 | |
| 手环开机 | `4176:17167` | 1 | |
| 开机震动棒 | `4176:17315` | 1 | |
| 震动棒匹配中 | `4176:17466` | 1 | |

### Login flow

1. **Open-animation** (first launch)
2. **Login**
   - Email + password
   - Remember me
   - Forgot password → Email-verification → email-verification-02 → new-password → password-reset-confirmation → Login
   - Log in → success → Onboarding (new) or Home (returning)
   - “Don’t have an account? Sign Up”
   - Or continue with Facebook / Google / Apple
3. **Sign Up** (not always named separately; treated as Login sibling)
   - Email-verification → Email verified → Profile-setup → User-info
4. **Onboarding Info** (4 states) then **device pairing**
   - 手环开机 → 手环连app → 开机震动棒 → 震动棒匹配中 → Device-04 (6 pairing states)
5. **User feedback** (6 states) then Home

---

## 2. Home-remote (`3005:9634`)

Main logged-in product surface.

| Screen | Figma node | Role |
|---|---|---|
| Home | `3005:9724` | Hub: Performance / Pattern / Kink / Sync cards |
| Remote-color-folded | `3005:9635` | Folded remote control |
| Performance | `3005:10086` | Performance list / detail |
| Performance-play | `3005:12101` | Playing a performance |
| Pattern / Pattern-default | `3887:2341` / `3005:10347` | Pattern library + editor |
| Kink / Kink-default / Kink-play / Kink-detail | `3005:11020` family | Kink wizard + play |
| Sync / Sync-waiting / Sync-matched | `3005:10801` family | Partner sync |
| quick-bliss-time | `3005:11961` | Quick Bliss timer |
| deep-discovery-time | `3005:12031` | Deep Discovery timer |
| Feed-5 | `3005:13231` | Feed / social card |

Existing code: `src/screens/home`, `control`, `kink`, `sync`, `quick_bliss`, `motion`.

---

## 3. Message (`3005:7524`)

Figma labels along the top of this board (flow groups, not always frame names):

- message & search
- chat (text)
- chat (regenerate + interaction)
- chat (drawer)
- chat (voice message)
- add contact
- bot settings
- Premium
- more
- sync
- Voice call
- 真人

Frame names reuse Home names (`Performance`, `Language`, `Feed-5`, `Remote-color-folded`, `Sync-*`). Treat them as **chat/message states**, not Home screens.

There is a second Message board (`5736:20680`). Confirm which is canonical before implementing.

Existing code: `src/screens/chat`.

---

## 4. Profile & settings (`3005:8480`)

| Screen | Figma node | Role |
|---|---|---|
| Language | `3005:8481` | Settings list / language (7 states) |
| Profile | `3005:9530` | Profile (tall, 1476) |
| Profile-setup | `3146:3395` | Edit profile |
| User-info | `3147:3675` | Edit user info |
| Email-verification / new-password / confirmation | `3147:3954` family | Change email / password from settings |
| Info | `4219:2488` | About / help |

Existing code: `src/screens/profile`.

---

## 5. Love (`3777:4584`)

Home (6 states) + Performance (8 states) + Sync-matched. In-app AI love overlay on Home / Performance / Sync.

---

## 6. Avatar Creation (`3005:9633`)

19 frames named `Language` plus 1 `Performance`. This is a **stepped avatar wizard**; names are not the product names. Implementation must read each frame’s copy, not the layer name.

---

## 7. Pattern Creation (`3885:8412`)

| Screen | Figma node |
|---|---|
| Home | `3885:9947` |
| Language (entry/settings) | `3885:10007` |
| Kink-default | `3885:10136` |
| Pattern-default | `3885:10201` (9 states) |
| Performance | `3885:10477` |
| Pattern | `3885:10550` (incl. tall 1227 save/preview) |
| Kink-play | `4308:6177` |

Existing code: `src/screens/control/sub-screens/pattern`.

---

## Visual / logic rules

1. Pixel match Figma: type, assets, layout, spacing, shadows, 393-wide frames.
2. Same-named frames in one section = states (empty/filled, selected, error, loading, success), not extra routes.
3. Bottom tabs from Home: Home, Remote, Message, Love, Profile — confirm icon set against Figma “未点击/点击图标对比”.
4. One React Native codebase. iOS via Xcode. “localhost” here means Metro + simulator/device, not a separate web app, unless you add `react-native-web`.
5. Do not invent copy, icons, or flows. If a frame is ambiguous, stop and ask.

---

## Implementation order (proposed)

1. Login & Onboarding (entry + pairing)
2. Home hub + Remote
3. Pattern / Performance / Kink / Sync / Quick Bliss
4. Profile & settings
5. Message / Love
6. Avatar Creation

---

## Open questions

1. Scope only **UI 2.0-front end (read me!)**? Ignore UI 1.5 / Web / iWatch?
2. Which **Message** board is canonical: `3005:7524` or `5736:20680`?
3. Localhost = Metro + iOS Simulator, or a real browser (needs react-native-web)?
4. Start coding from **Login**, or another module first?
5. UI language: English as in Figma, Chinese, or both?
6. Keep existing GraphQL/BLE backends, or UI-only against mocks first?
