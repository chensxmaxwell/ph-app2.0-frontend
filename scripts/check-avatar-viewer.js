#!/usr/bin/env node
/**
 * Renders assets/avatar-engine/viewer-page.html in headless Chrome (software
 * WebGL) and asserts what the 捏人 preview must show for every outfit: the
 * whole figure in frame, both hands drawn and on screen, the eyeball mesh
 * inside the head and scaled down with its bones by the look's Eyes Size
 * (eyeScaleFor: min clearly smaller than max, default 0.82 past the 0.58,
 * 0.65, 0.72 and 0.76 that read as too small, Size 1 under the 0.96 ceiling
 * that keeps it off the unscaled GLB eye), both irises converged on
 * the camera under a lowered upper lid, hair on the head, one posed master
 * skeleton. Screenshots (plus a 4x close-up of the eyes) go to --out (default
 * /tmp/ph-avatar-check) so a human can eyeball the poses and the face.
 *
 * A second pass renders the hoodie preset at 3x the CSS size (same framing,
 * more pixels per eye) and reads the eye pixels back: the upper lid must rest
 * on the iris at Size 0 / 0.5 / 1 (iris exposure and sclera share inside a
 * band per Size), the pupil must stay clear, the Outfit full-body camera and
 * the Eyes bust camera must show the same lid weight (TestFlight craft
 * screenshots: a wide stare in full, a resting lid in bust, from a
 * slope-scaled polygon offset that let the eyeball rim through the lids), and
 * the default eye must not be a pinprick at the Outfit camera (iris and
 * opening in CSS px), and the reference-pass feel must be on the render: the
 * inked lash card reads as a liner above the iris, the limbal ring is darker
 * than the mid iris, one hard glint sits on the iris, and Head_0's lash /
 * outer-corner morphs carry the look's weights. It also writes the full frame
 * per Size and camera (pixels-outfit2-<view>-size<n>-frame.png) for review
 * collages.
 *
 *   node scripts/check-avatar-viewer.js [--out DIR] [--chrome PATH]
 *
 * Needs Google Chrome / Chromium. Talks CDP over --remote-debugging-pipe, so
 * there is nothing to install. Exit code 1 when an assertion fails.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { startAvatarStaticServer } = require("./avatar-static-server");

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const at = args.indexOf(flag);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const OUT_DIR = argValue("--out", path.join(os.tmpdir(), "ph-avatar-check"));
const WIDTH = 393;
const HEIGHT = 854;
const CHROME_CANDIDATES = [
  process.env.PH_CHROME,
  argValue("--chrome", null),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

// Same presets as src/screens/avatar/engine/viewer-html.ts CHARACTER_PRESETS.
const PRESETS = [
  {
    appearanceIndex: 0,
    hairStyle: 0,
    hairColor: 0,
    skinTone: 0,
    eyeColor: 0,
    upperArms: 0.28,
    chest: 0.32,
    forearms: 0.32,
    backAndHips: 0.34,
    faceWidth: 0.28,
    jaw: 0.3,
    chin: 0.42,
    eyeSize: 0.58,
    age: 0.18,
  },
  {
    appearanceIndex: 1,
    hairStyle: 1,
    hairColor: 1,
    skinTone: 1,
    eyeColor: 3,
    upperArms: 0.58,
    chest: 0.62,
    forearms: 0.52,
    backAndHips: 0.6,
    faceWidth: 0.58,
    jaw: 0.55,
    chin: 0.5,
    eyeSize: 0.52,
    age: 0.32,
  },
  {
    appearanceIndex: 2,
    hairStyle: 2,
    hairColor: 1,
    skinTone: 1,
    eyeColor: 0,
    upperArms: 0.45,
    chest: 0.5,
    forearms: 0.45,
    backAndHips: 0.48,
    faceWidth: 0.48,
    jaw: 0.46,
    chin: 0.5,
    eyeSize: 0.5,
    age: 0.28,
  },
  {
    appearanceIndex: 3,
    hairStyle: 3,
    hairColor: 4,
    skinTone: 2,
    eyeColor: 0,
    upperArms: 0.68,
    chest: 0.72,
    forearms: 0.62,
    backAndHips: 0.74,
    faceWidth: 0.66,
    jaw: 0.64,
    chin: 0.58,
    eyeSize: 0.44,
    age: 0.22,
  },
];

const LOOKS = [];
PRESETS.forEach((preset) => {
  LOOKS.push({
    name: `outfit${preset.appearanceIndex}-full`,
    look: { ...preset, viewMode: "full", revealBody: false },
  });
});
LOOKS.push({
  name: "outfit2-bust",
  look: { ...PRESETS[2], viewMode: "bust", revealBody: false },
});
LOOKS.push({
  name: "outfit0-body-reveal",
  look: { ...PRESETS[0], viewMode: "full", revealBody: true },
});
// The Eyes tab's Size slider at both ends, on the jacket preset TestFlight
// 1.2 (14) was walked with: the two renders must differ visibly.
const EYES_MIN_LOOK = "outfit1-bust-eyes-min";
const EYES_MAX_LOOK = "outfit1-bust-eyes-max";
LOOKS.push({
  name: EYES_MIN_LOOK,
  look: { ...PRESETS[1], eyeSize: 0, viewMode: "bust", revealBody: false },
});
LOOKS.push({
  name: EYES_MAX_LOOK,
  look: { ...PRESETS[1], eyeSize: 1, viewMode: "bust", revealBody: false },
});

const findChrome = () =>
  CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));

class Cdp {
  constructor(chromePath) {
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.buffer = "";
    this.userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ph-avatar-chrome-")
    );
    this.proc = spawn(
      chromePath,
      [
        "--headless=new",
        "--remote-debugging-pipe",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--hide-scrollbars",
        "--mute-audio",
        `--user-data-dir=${this.userDataDir}`,
        `--window-size=${WIDTH},${HEIGHT}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] }
    );
    this.proc.stderr.on("data", () => {});
    this.proc.stdio[4].on("data", (chunk) => this.onData(chunk));
  }

  onData(chunk) {
    this.buffer += chunk.toString("utf8");
    let at = this.buffer.indexOf("\0");
    while (at >= 0) {
      const raw = this.buffer.slice(0, at);
      this.buffer = this.buffer.slice(at + 1);
      at = this.buffer.indexOf("\0");
      if (!raw) continue;
      const message = JSON.parse(raw);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    }
  }

  send(method, params, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdio[3].write(JSON.stringify(payload) + "\0");
    });
  }

  async close() {
    const exited = new Promise((resolve) => {
      this.proc.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
    try {
      this.proc.kill();
    } catch (err) {
      // already gone
    }
    await exited;
    try {
      fs.rmSync(this.userDataDir, { recursive: true, force: true });
    } catch (err) {
      // Chrome may still be flushing its profile; a stale temp dir is harmless.
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const evaluate = async (cdp, session, expression) => {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session
  );
  if (result.exceptionDetails) {
    throw new Error(
      "page threw: " +
        JSON.stringify(
          result.exceptionDetails.exception || result.exceptionDetails.text
        )
    );
  }
  return result.result.value;
};

// Eyes_0 in bozo-male.glb: two spheres of radius 22.2 mm (sphere fit, 0.04 mm
// residual), centred on eyeRoot_l/r.
const EYEBALL_DIAMETER = 0.0444;
const EYEBALL_RADIUS = EYEBALL_DIAMETER / 2;
// TestFlight 1.2 (14) shipped a fixed eye-bone scale of 0.70 under a stare
// lid; with the resting lid the default look now sits past it (0.82, the
// reference pass) and Size 1 at 0.94. Under this lid the sclera share stays
// ~0.36 at every scale (measured 0.46..1.0), so the 1.2 (11) sclera-dominant
// saucer cannot recur, and the lid-to-brow gap stays 24-25 CSS px in the
// bust from 0.60 to 1.0 (the crease rises with the lid margin), so a big eye
// does not crowd the brow either. The one top-end guard left is the unscaled
// GLB eye (1.0, the 1.2 (11)-(13) eye Maxwell asked to shrink): Size 1 stays
// under it.
const PREVIOUS_FIXED_EYE_SCALE = 0.7;
const EYE_SCALE_CEILING = 0.96;
// Rendered Eyes_0 height per look name, for the Size min/max spread check.
const eyeHeights = {};

// Pixel pass: the hoodie preset (Maxwell's craft walk) at Size 0 / 0.5 / 1
// from the Outfit full-body camera and the Eyes bust camera, at 3x CSS size.
const PIXEL_SCALE = 3;
const PIXEL_PRESET = PRESETS[2];
const PIXEL_SIZES = [0, 0.5, 1];
// Per Size: the share of the projected iris disc left uncovered by the lids
// and the sclera share of the opening, measured on the render. Before this
// model the lid covered 0-8% of the iris (exposure 0.92-1.00) and the
// full-body view showed 45-61% sclera; a resting adult lid covers 15-25%.
const EYE_BANDS = {
  0: { irisExposure: [0.55, 0.82], scleraShare: [0.1, 0.32] },
  0.5: { irisExposure: [0.65, 0.88], scleraShare: [0.12, 0.36] },
  1: { irisExposure: [0.72, 0.93], scleraShare: [0.15, 0.4] },
};
// Full vs bust: same lid weight, same iris share, within measurement noise
// (head sway plus the 3x full-body eye being ~18 px in radius).
const PARITY_IRIS_EXPOSURE = 0.1;
const PARITY_SCLERA_SHARE = 0.08;
// The default eye at the Outfit full-body camera, in CSS px (1x): Maxwell's
// craft walk of the 0.58 default read the eyes as too small - iris 5.1 px
// across, the sclera + iris opening 25 px^2 (4.3 px tall), a pinprick under
// the fringe - and his reviews of the 0.65 pass (iris 5.8 px, opening 32
// px^2), the 0.72 pass (6.4 px, 38 px^2) and the 0.76 pass (6.7 px, 42 px^2)
// said still too small. At 0.82 the iris is 7.3 px and the opening ~47 px^2.
// The iris diameter is analytic (bone scale x camera) and its threshold sits
// above the 0.76 pass so a slide back fails here; the opening is counted on
// the render, where a 10 x 6 px blob moves +-2 px^2 with the parked
// idle-sway phase, so its threshold only guards the 0.58 / 0.65 sizes.
const DEFAULT_FULL_MIN_IRIS_PX = 7.0;
const DEFAULT_FULL_MIN_OPENING_PX2 = 36;
// And in the Eyes bust: iris 13.0 px at 0.58, 14.5 at 0.65, 16.1 at 0.72,
// 17.0 at 0.76, 18.3 at 0.82.
const DEFAULT_BUST_MIN_IRIS_PX = 17.6;
// The reference pass, measured on the hoodie default in the bust with the
// feel pack switched off (same 0.82 scale) and on: liner rows above the iris
// 0.0 -> 2.8 CSS px, limbal ring / mid-iris luminance 0.64 -> 0.49, glint
// share of the iris disc 0.0% -> 2.9% (the 1.2 (12) blob whitened 15-49%).
// The real #36 / pass-3 viewer measures 0.58 on the ring (its 30% rim mixed
// at 0.72), so the ring threshold sits under that.
const DEFAULT_BUST_MIN_LINER_PX = 2;
const DEFAULT_BUST_MAX_RIM_OVER_MID = 0.54;
const DEFAULT_BUST_GLINT_SHARE = [0.005, 0.06];
// Shape_LashLength and Shape_EyesOuterCornersHigh on Head_0, read back from
// the morph influences on every look (#36 ran 0.42 and 0).
const MIN_LASH_LENGTH = 0.7;
const OUTER_CORNER_LIFT = [0.5, 1];

const failures = [];
const check = (name, condition, detail) => {
  const line = `${condition ? "ok  " : "FAIL"} ${name}${
    detail ? " — " + detail : ""
  }`;
  console.log(line);
  if (!condition) failures.push(line);
};

const insideFrame = (frame, margin) =>
  !!frame &&
  frame.minX >= -1 - margin &&
  frame.maxX <= 1 + margin &&
  frame.minY >= -1 - margin &&
  frame.maxY <= 1 + margin;

const boxInside = (inner, outer, slack) =>
  !!inner &&
  !!outer &&
  inner.min.every((v, i) => v >= outer.min[i] - slack) &&
  inner.max.every((v, i) => v <= outer.max[i] + slack);

const center = (box) => box.min.map((v, i) => (v + box.max[i]) / 2);

// CSS-pixel clip around a projected (NDC) frame, padded to twice its size.
const eyeClip = (frame) => {
  const x0 = ((frame.minX + 1) / 2) * WIDTH;
  const x1 = ((frame.maxX + 1) / 2) * WIDTH;
  const y0 = ((1 - frame.maxY) / 2) * HEIGHT;
  const y1 = ((1 - frame.minY) / 2) * HEIGHT;
  const padX = (x1 - x0) / 2;
  const padY = (y1 - y0) / 2;
  return {
    x: Math.max(0, x0 - padX),
    y: Math.max(0, y0 - padY),
    width: Math.min(WIDTH, x1 - x0 + 2 * padX),
    height: Math.min(HEIGHT, y1 - y0 + 2 * padY),
    scale: 4,
  };
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const assertLook = (entry, state, wantScale) => {
  const tag = entry.name;
  const full = entry.look.viewMode !== "bust";
  const meshes = state.meshes || {};
  const hand = meshes.Body_Hand;
  const eyes = meshes.Eyes_0;
  const head = meshes.Head_0;
  const hips = meshes.Body_Hips;
  const chest = meshes.Body_Chest;
  check(`${tag}: viewer ready`, state.ready === true);
  check(
    `${tag}: model height plausible`,
    state.modelHeight > 1.5 && state.modelHeight < 2.1,
    `h=${state.modelHeight.toFixed(3)}`
  );
  check(
    `${tag}: one master skeleton drives the rig`,
    state.masterBoneCount >= 70 && state.armBoneCount === 8,
    `master=${state.masterBoneCount} arm=${state.armBoneCount}`
  );
  if (full) {
    check(
      `${tag}: figure inside the frame`,
      insideFrame(state.figureFrame, 0.02),
      JSON.stringify(state.figureFrame)
    );
  }
  check(`${tag}: hands drawn`, !!hand && hand.visible);
  if (hand && hand.visible && hand.box) {
    if (full) {
      check(
        `${tag}: hands on screen`,
        insideFrame(hand.frame, 0.0),
        JSON.stringify(hand.frame)
      );
    }
    check(
      `${tag}: hands not behind the back`,
      hand.box.max[2] > -0.05,
      `z=${hand.box.max[2].toFixed(3)}`
    );
    if (hips && hips.box && chest && chest.box) {
      // Hands either hang beside the hips or sit in front of the chest;
      // the old pose table buried them between the thighs.
      const beside =
        hand.box.max[0] > hips.box.max[0] + 0.03 &&
        hand.box.min[0] < hips.box.min[0] - 0.03;
      const handZ = (hand.box.min[2] + hand.box.max[2]) / 2;
      const inFront = handZ > chest.box.max[2] + 0.02;
      check(
        `${tag}: hands not inside the torso`,
        beside || inFront,
        `hand x ${hand.box.min[0].toFixed(2)}..${hand.box.max[0].toFixed(
          2
        )} centre z ${handZ.toFixed(2)} chest front ${chest.box.max[2].toFixed(
          2
        )}`
      );
    }
  }
  check(`${tag}: eyeball mesh drawn`, !!eyes && eyes.visible);
  if (eyes && eyes.visible && head) {
    check(
      `${tag}: eyeballs inside the head`,
      boxInside(eyes.box, head.box, 0.01),
      JSON.stringify(eyes.box)
    );
    if (entry.look.viewMode === "bust") {
      check(
        `${tag}: eyes framed in the bust view`,
        insideFrame(eyes.frame, 0) && eyes.frame.minY > 0.2,
        JSON.stringify(eyes.frame)
      );
    }
  }
  // TestFlight 1.2 (12): lids wide open, eyes parallel and aimed above the
  // camera. Both irises must point at the camera (they converge, so the
  // forward vectors are not parallel) and the upper lid must be lowered.
  const gaze = (state.eyes && state.eyes.gaze) || {};
  const left = gaze.eyeRoot_l;
  const right = gaze.eyeRoot_r;
  check(`${tag}: both eye bones found`, !!left && !!right);
  if (left && right) {
    check(
      `${tag}: irises aimed at the camera`,
      left.offCameraDeg < 1.5 && right.offCameraDeg < 1.5,
      `l=${left.offCameraDeg.toFixed(2)}deg r=${right.offCameraDeg.toFixed(
        2
      )}deg`
    );
    check(
      `${tag}: eyes look down toward the camera, not past it`,
      left.forward[1] < -0.05 && right.forward[1] < -0.05,
      `fwd.y l=${left.forward[1].toFixed(3)} r=${right.forward[1].toFixed(3)}`
    );
    const dot =
      left.forward[0] * right.forward[0] +
      left.forward[1] * right.forward[1] +
      left.forward[2] * right.forward[2];
    check(
      `${tag}: eyes converge (right eye turned further toward +x than left)`,
      right.forward[0] > left.forward[0] + 0.005 && dot > 0.95,
      `fwd.x l=${left.forward[0].toFixed(3)} r=${right.forward[0].toFixed(3)}`
    );
  }
  // Calibrated on the render: 0.16-0.20 (1.2 (14)) left the iris 91-97%
  // uncovered - a stare; the lid reaches the pupil at ~0.34.
  const lidDrop = state.eyes ? state.eyes.lidDrop : null;
  check(
    `${tag}: upper lid rests on the iris, off the pupil`,
    typeof lidDrop === "number" && lidDrop >= 0.2 && lidDrop <= 0.31,
    `Shape_EyeLidHeight=${lidDrop}`
  );
  // TestFlight 1.2 (13): the whole eye was still too big, so the eye bones
  // are scaled. 1.2 (14): a fixed 0.70 at every Size, so the slider did
  // nothing visible. The bones must carry eyeScaleFor(look.eyeSize), and the
  // Eyes_0 box - two 22.2 mm spheres - must be that fraction of 44.4 mm.
  if (left && right) {
    check(
      `${tag}: eye bones scaled by eyeScaleFor(eyeSize=${entry.look.eyeSize})`,
      typeof wantScale === "number" &&
        wantScale > 0.3 &&
        wantScale < 1 &&
        Math.abs(left.scale - wantScale) < 1e-6 &&
        Math.abs(right.scale - wantScale) < 1e-6,
      `want=${wantScale} l=${left.scale} r=${right.scale}`
    );
  }
  if (eyes && eyes.box) {
    const height = eyes.box.max[1] - eyes.box.min[1];
    const want = EYEBALL_DIAMETER * wantScale;
    eyeHeights[tag] = height;
    check(
      `${tag}: eyeballs shrunk with the bones`,
      Math.abs(height - want) < 0.002 &&
        height < EYEBALL_DIAMETER * EYE_SCALE_CEILING + 0.002,
      `Eyes_0 height ${height.toFixed(4)} m, want ${want.toFixed(4)}`
    );
  }
  if (head) {
    const headCenter = center(head.box);
    Object.keys(meshes)
      .filter(
        (name) =>
          name.indexOf("Hair_") === 0 &&
          meshes[name].visible &&
          meshes[name].box
      )
      .forEach((name) => {
        const d = distance(center(meshes[name].box), headCenter);
        check(
          `${tag}: ${name} sits on the head`,
          d < 0.35,
          `d=${d.toFixed(3)}`
        );
      });
  }
  const expectedOutfit = `Outfit_${entry.look.appearanceIndex}_`;
  const wrongOutfit = (state.visible || []).filter(
    (name) =>
      name.indexOf("Outfit_") === 0 && name.indexOf(expectedOutfit) !== 0
  );
  check(
    `${tag}: only the selected outfit is drawn`,
    wrongOutfit.length === 0,
    wrongOutfit.join(",")
  );
};

// Decode a PNG (base64) inside the page - an Image drawn onto a 2D canvas -
// and return its RGBA bytes; Node has no PNG decoder of its own.
const pixelsOf = async (cdp, session, pngBase64) =>
  evaluate(
    cdp,
    session,
    `new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        var d = ctx.getImageData(0, 0, c.width, c.height).data;
        resolve({ width: c.width, height: c.height, data: Array.prototype.slice.call(d) });
      };
      img.onerror = function () { reject(new Error("png decode failed")); };
      img.src = "data:image/png;base64,${pngBase64}";
    })`
  );

// Classify the pixels of one eye. `cx`/`cy` is the eyeball centre in the
// clip, `r` its radius in px, `rIris` the painted iris radius in px. Sclera
// is bright and neutral; lid skin is warm and, for the hoodie preset's skin
// tone, lum >= 124 in these renders while the brown iris's light inner ring
// tops out near 100; anything else inside the iris disc (iris, pupil,
// catchlight, lash line on the margin) counts as visible iris.
const measureEye = (png, cx, cy, r, rIris, rPupil) => {
  const { width, height, data } = png;
  let sclera = 0;
  let irisVisible = 0;
  let pupilTopDark = 0;
  let pupilTopSamples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 1.4 * r) continue;
      const i = (y * width + x) * 4;
      const R = data[i];
      const G = data[i + 1];
      const B = data[i + 2];
      const mx = Math.max(R, G, B);
      const mn = Math.min(R, G, B);
      const lum = 0.299 * R + 0.587 * G + 0.114 * B;
      const neutral = mx - mn < 24;
      const isSclera = neutral && lum > 120;
      const isSkin = !neutral && R > B + 30 && lum >= 112;
      if (dist <= rIris * 1.04) {
        if (!isSkin) irisVisible += 1;
        // The upper part of the pupil on the centre line must still be
        // pupil (dark): the lid has not come down over the pupil. The
        // catchlight (its core and its soft edge) sits on the pupil's
        // upper-right edge and the fill light's clearcoat reflection on the
        // upper-left; both are neutral grey-to-white, the lid is warm skin,
        // so neutral pixels above the pupil's own luminance are left out.
        if (
          Math.abs(dx) <= 0.1 * r &&
          dy > -rPupil * 0.85 &&
          dy < -rPupil * 0.45 &&
          !(neutral && lum >= 90)
        ) {
          pupilTopSamples += 1;
          if (lum < 90) pupilTopDark += 1;
        }
      } else if (isSclera) {
        sclera += 1;
      }
    }
  }
  // The reference pass (liner, limbal ring, glint). Liner: dark rows on a
  // 7 px column straight above the iris top - the inked upper lash card -
  // until three skin rows. Ring: mean luminance of the limbal annulus against
  // the mid-iris annulus over the lower half of the iris (the top is under
  // the lid). Glint: share of the iris disc that is near-white and neutral.
  let linerRows = 0;
  let skinRun = 0;
  const columnX = Math.round(cx);
  const irisTop = Math.round(cy - rIris);
  for (let dy = 0; dy < 0.6 * r; dy += 1) {
    const y = irisTop - dy;
    if (y < 0) break;
    let dark = 0;
    let skin = 0;
    for (let x = columnX - 3; x <= columnX + 3; x += 1) {
      if (x < 0 || x >= width) continue;
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 70) dark += 1;
      if (data[i] > data[i + 2] + 30 && lum >= 112) skin += 1;
    }
    if (dark >= 4) linerRows += 1;
    skinRun = skin >= 4 ? skinRun + 1 : 0;
    if (skinRun >= 3 && dy > 2) break;
  }
  const annulusLum = (inner, outer) => {
    let sum = 0;
    let count = 0;
    for (let y = Math.floor(cy); y <= Math.ceil(cy + rIris); y += 1) {
      for (
        let x = Math.floor(cx - rIris) - 1;
        x <= Math.ceil(cx + rIris) + 1;
        x += 1
      ) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const rel = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rIris;
        if (rel < inner || rel > outer) continue;
        const i = (y * width + x) * 4;
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        count += 1;
      }
    }
    return sum / Math.max(1, count);
  };
  const rimLum = annulusLum(0.86, 0.98);
  const midLum = annulusLum(0.42, 0.66);
  let glintPx = 0;
  let discPx = 0;
  for (let y = Math.floor(cy - rIris); y <= Math.ceil(cy + rIris); y += 1) {
    for (let x = Math.floor(cx - rIris); x <= Math.ceil(cx + rIris); x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > rIris) continue;
      discPx += 1;
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const spread =
        Math.max(data[i], data[i + 1], data[i + 2]) -
        Math.min(data[i], data[i + 1], data[i + 2]);
      if (lum > 190 && spread < 40) glintPx += 1;
    }
  }
  return {
    irisExposure: irisVisible / (Math.PI * rIris * rIris),
    scleraShare: sclera / Math.max(1, sclera + irisVisible),
    // The eye opening the viewer actually sees: sclera plus uncovered iris,
    // in render px (the caller divides by PIXEL_SCALE^2 for CSS px^2).
    openingPx: sclera + irisVisible,
    linerRows,
    rimOverMid: rimLum / Math.max(1, midLum),
    glintShare: glintPx / Math.max(1, discPx),
    // A pupil under ~4 px (the full-body eye at Size 0) has a 2-pixel sample
    // window that antialiasing decides; the lid position is camera-independent
    // (see the parity checks), so the bust view carries this assertion.
    pupilClear:
      rPupil < 4
        ? null
        : pupilTopSamples > 0 && pupilTopDark / pupilTopSamples > 0.6,
  };
};

const within = (value, [lo, hi]) => value >= lo && value <= hi;

// Park the viewer's requestAnimationFrame loop so the idle breathing / head
// sway cannot move the eye between the probe and the capture (a 3x
// SwiftShader frame takes seconds). `stepFrames` then runs the parked
// animate() callback by hand: one call = one rendered frame.
const freezeAnimation = async (cdp, session) => {
  await evaluate(
    cdp,
    session,
    `window.__phRealRaf = window.__phRealRaf || window.requestAnimationFrame.bind(window);
     window.__phParked = null;
     window.requestAnimationFrame = function (cb) { window.__phParked = cb; return 0; };
     true`
  );
  // The frame already scheduled with the real rAF fires once more and parks.
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if (await evaluate(cdp, session, "!!window.__phParked")) return;
    await sleep(50);
  }
  throw new Error("viewer animation loop never parked");
};

const stepFrames = (cdp, session, count) =>
  evaluate(
    cdp,
    session,
    `(function () {
      for (var i = 0; i < ${count}; i++) {
        var cb = window.__phParked; window.__phParked = null;
        if (cb) cb(performance.now());
      }
      return !!window.__phParked;
    })()`
  );

const resumeAnimation = (cdp, session) =>
  evaluate(
    cdp,
    session,
    `(function () {
      window.requestAnimationFrame = window.__phRealRaf;
      var cb = window.__phParked; window.__phParked = null;
      if (cb) window.requestAnimationFrame(cb);
      return true;
    })()`
  );

const pixelPass = async (cdp, session) => {
  const width = WIDTH * PIXEL_SCALE;
  const height = HEIGHT * PIXEL_SCALE;
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 1, mobile: true },
    session
  );
  // Let the viewer pick up the new size before parking the loop.
  await evaluate(
    cdp,
    session,
    "new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(r, 80); }); }); })"
  );
  await freezeAnimation(cdp, session);
  const irisRadius = await evaluate(
    cdp,
    session,
    "[window.phViewerRig.IRIS_RADIUS, window.phViewerRig.PUPIL_RADIUS]"
  );
  const [IRIS_RADIUS, PUPIL_RADIUS] = irisRadius;
  const results = {};
  for (const eyeSize of PIXEL_SIZES) {
    for (const viewMode of ["full", "bust"]) {
      const look = { ...PIXEL_PRESET, eyeSize, viewMode, revealBody: false };
      const tag = `pixels outfit2-${viewMode}-size${eyeSize}`;
      await evaluate(
        cdp,
        session,
        `window.applyLook(${JSON.stringify(look)}); true`
      );
      const stillParked = await stepFrames(cdp, session, 2);
      check(
        `${tag}: rendered two frames with the animation parked`,
        stillParked
      );
      const state = await evaluate(cdp, session, "window.phViewerState()");
      const irisSize = await evaluate(
        cdp,
        session,
        `window.phViewerRig.irisSizeFor(${eyeSize})`
      );
      const frame = await cdp.send(
        "Page.captureScreenshot",
        { format: "png" },
        session
      );
      fs.writeFileSync(
        path.join(
          OUT_DIR,
          `pixels-outfit2-${viewMode}-size${eyeSize}-frame.png`
        ),
        Buffer.from(frame.data, "base64")
      );
      const eyes = [];
      for (const bone of ["eyeRoot_l", "eyeRoot_r"]) {
        const gaze = state.eyes.gaze[bone];
        if (!gaze || !gaze.screen) continue;
        const r = EYEBALL_RADIUS * gaze.scale * gaze.screen.pxPerMetre;
        const rIris = r * Math.sin((IRIS_RADIUS * irisSize * Math.PI) / 2);
        const rPupil = r * Math.sin((PUPIL_RADIUS * irisSize * Math.PI) / 2);
        const half = 1.6 * r;
        const clip = {
          x: gaze.screen.x - half,
          y: gaze.screen.y - half,
          width: 2 * half,
          height: 2 * half,
          scale: 1,
        };
        const shot = await cdp.send(
          "Page.captureScreenshot",
          { format: "png", clip },
          session
        );
        const png = await pixelsOf(cdp, session, shot.data);
        const scaleX = png.width / clip.width;
        const scaleY = png.height / clip.height;
        const eye = measureEye(
          png,
          (gaze.screen.x - clip.x) * scaleX,
          (gaze.screen.y - clip.y) * scaleY,
          r * scaleX,
          rIris * scaleX,
          rPupil * scaleX
        );
        // Back to CSS px (1x) so the numbers match what the phone lays out.
        eye.irisDiameterCss = (2 * rIris) / PIXEL_SCALE;
        eye.openingCss2 =
          eye.openingPx / (scaleX * scaleY * PIXEL_SCALE * PIXEL_SCALE);
        eyes.push(eye);
        if (bone === "eyeRoot_l") {
          fs.writeFileSync(
            path.join(OUT_DIR, `pixels-outfit2-${viewMode}-size${eyeSize}.png`),
            Buffer.from(shot.data, "base64")
          );
        }
      }
      check(`${tag}: both eyes located on screen`, eyes.length === 2);
      if (eyes.length !== 2) continue;
      const measurable = eyes.every((eye) => eye.pupilClear !== null);
      const avg = {
        irisExposure: (eyes[0].irisExposure + eyes[1].irisExposure) / 2,
        scleraShare: (eyes[0].scleraShare + eyes[1].scleraShare) / 2,
        irisDiameterCss:
          (eyes[0].irisDiameterCss + eyes[1].irisDiameterCss) / 2,
        openingCss2: (eyes[0].openingCss2 + eyes[1].openingCss2) / 2,
        linerCss: (eyes[0].linerRows + eyes[1].linerRows) / 2 / PIXEL_SCALE,
        rimOverMid: (eyes[0].rimOverMid + eyes[1].rimOverMid) / 2,
        glintShare: (eyes[0].glintShare + eyes[1].glintShare) / 2,
        pupilClear: measurable
          ? eyes[0].pupilClear && eyes[1].pupilClear
          : null,
      };
      results[`${viewMode}-${eyeSize}`] = avg;
      console.log(
        `     ${tag}: iris ${avg.irisDiameterCss.toFixed(
          1
        )} CSS px across, opening ${avg.openingCss2.toFixed(
          0
        )} CSS px^2, liner ${avg.linerCss.toFixed(
          1
        )} px, rim/mid ${avg.rimOverMid.toFixed(2)}, glint ${(
          avg.glintShare * 100
        ).toFixed(1)}%`
      );
      // The reference pass: lashes lengthened and outer corners lifted on
      // every look (read back from Head_0's morph influences).
      check(
        `${tag}: lashes lengthened (Shape_LashLength >= ${MIN_LASH_LENGTH})`,
        typeof state.eyes.lashLength === "number" &&
          state.eyes.lashLength >= MIN_LASH_LENGTH &&
          state.eyes.lashLength <= 1,
        `Shape_LashLength=${state.eyes.lashLength}`
      );
      check(
        `${tag}: outer corners lifted (Shape_EyesOuterCornersHigh in ${OUTER_CORNER_LIFT.join(
          ".."
        )})`,
        typeof state.eyes.outerCornerLift === "number" &&
          within(state.eyes.outerCornerLift, OUTER_CORNER_LIFT),
        `Shape_EyesOuterCornersHigh=${state.eyes.outerCornerLift}`
      );
      if (eyeSize === 0.5 && viewMode === "bust") {
        check(
          `${tag}: liner inked above the iris (>= ${DEFAULT_BUST_MIN_LINER_PX} CSS px of dark rows)`,
          avg.linerCss >= DEFAULT_BUST_MIN_LINER_PX,
          `liner ${avg.linerCss.toFixed(2)} CSS px`
        );
        check(
          `${tag}: limbal ring darker than the mid iris (rim/mid <= ${DEFAULT_BUST_MAX_RIM_OVER_MID})`,
          avg.rimOverMid <= DEFAULT_BUST_MAX_RIM_OVER_MID,
          `rim/mid ${avg.rimOverMid.toFixed(3)}`
        );
        check(
          `${tag}: one hard glint on the iris, not a blob (glint share in ${DEFAULT_BUST_GLINT_SHARE.join(
            ".."
          )})`,
          within(avg.glintShare, DEFAULT_BUST_GLINT_SHARE),
          `glint ${(avg.glintShare * 100).toFixed(2)}% of the iris disc`
        );
      }
      if (eyeSize === 0.5) {
        // The craft-walk complaint on the 0.58 default: eyes too small in the
        // Outfit step. The default eye must read as an eye from both cameras.
        const minIris =
          viewMode === "full"
            ? DEFAULT_FULL_MIN_IRIS_PX
            : DEFAULT_BUST_MIN_IRIS_PX;
        check(
          `${tag}: default iris is not a pinprick (>= ${minIris} CSS px across)`,
          avg.irisDiameterCss >= minIris,
          `iris ${avg.irisDiameterCss.toFixed(2)} CSS px`
        );
        if (viewMode === "full") {
          check(
            `${tag}: default eye opening reads at the Outfit camera (>= ${DEFAULT_FULL_MIN_OPENING_PX2} CSS px^2)`,
            avg.openingCss2 >= DEFAULT_FULL_MIN_OPENING_PX2,
            `opening ${avg.openingCss2.toFixed(1)} CSS px^2`
          );
        }
      }
      const band = EYE_BANDS[eyeSize];
      check(
        `${tag}: upper lid rests on the iris (exposure in band)`,
        within(avg.irisExposure, band.irisExposure),
        `irisExposure=${avg.irisExposure.toFixed(
          3
        )} want ${band.irisExposure.join("..")}`
      );
      check(
        `${tag}: iris, not sclera, carries the eye (sclera share in band)`,
        within(avg.scleraShare, band.scleraShare),
        `scleraShare=${avg.scleraShare.toFixed(3)} want ${band.scleraShare.join(
          ".."
        )}`
      );
      if (viewMode === "bust") {
        check(
          `${tag}: lid stays above the pupil`,
          avg.pupilClear === true,
          avg.pupilClear === null ? "pupil under 4 px, not measurable" : ""
        );
      }
    }
    const full = results[`full-${eyeSize}`];
    const bust = results[`bust-${eyeSize}`];
    if (full && bust) {
      check(
        `pixels size${eyeSize}: Outfit full-body and Eyes bust show the same lid weight`,
        Math.abs(full.irisExposure - bust.irisExposure) <= PARITY_IRIS_EXPOSURE,
        `irisExposure full=${full.irisExposure.toFixed(
          3
        )} bust=${bust.irisExposure.toFixed(3)}`
      );
      check(
        `pixels size${eyeSize}: Outfit full-body and Eyes bust show the same sclera share`,
        Math.abs(full.scleraShare - bust.scleraShare) <= PARITY_SCLERA_SHARE,
        `scleraShare full=${full.scleraShare.toFixed(
          3
        )} bust=${bust.scleraShare.toFixed(3)}`
      );
    }
  }
  // Size must still read as a monotone change in the eye, not just the lid.
  const small = results["bust-0"];
  const large = results["bust-1"];
  if (small && large) {
    check(
      "pixels: small eyes carry more iris than large eyes (sclera share grows with Size)",
      small.scleraShare < large.scleraShare,
      `Size 0 ${small.scleraShare.toFixed(
        3
      )} vs Size 1 ${large.scleraShare.toFixed(3)}`
    );
  }
  await resumeAnimation(cdp, session);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: true },
    session
  );
};

const main = async () => {
  const chrome = findChrome();
  if (!chrome) {
    console.error(
      "No Chrome/Chromium found. Pass --chrome PATH or set PH_CHROME."
    );
    process.exit(2);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = startAvatarStaticServer(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/viewer.html`;
  const cdp = new Cdp(chrome);
  try {
    const { targetId } = await cdp.send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: true },
      sessionId
    );
    await cdp.send(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source:
          "window.__phMessages = []; window.ReactNativeWebView = { postMessage: function (m) { window.__phMessages.push(String(m)); } };",
      },
      sessionId
    );
    await cdp.send("Page.navigate", { url }, sessionId);
    const started = Date.now();
    let messages = [];
    while (Date.now() - started < 60000) {
      messages =
        (await evaluate(cdp, sessionId, "window.__phMessages || []")) || [];
      if (messages.some((m) => m === "ready" || m.indexOf("error:") === 0))
        break;
      await sleep(200);
    }
    check(
      "viewer posted ready",
      messages.includes("ready"),
      JSON.stringify(messages)
    );
    if (!messages.includes("ready")) {
      throw new Error("viewer never became ready");
    }
    const hasProbe = await evaluate(
      cdp,
      sessionId,
      "typeof window.phViewerState === 'function'"
    );
    check("viewer exposes phViewerState()", hasProbe);
    if (!hasProbe) {
      throw new Error(
        "viewer-page.html has no phViewerState probe; nothing to assert"
      );
    }
    const eyeScaleRange = await evaluate(
      cdp,
      sessionId,
      "window.phViewerRig && typeof window.phViewerRig.eyeScaleFor === 'function' && [window.phViewerRig.eyeScaleFor(0), window.phViewerRig.eyeScaleFor(0.5), window.phViewerRig.eyeScaleFor(1), window.phViewerRig.EYE_SCALE]"
    );
    check(
      "viewer exposes eyeScaleFor and EYE_SCALE",
      Array.isArray(eyeScaleRange) &&
        eyeScaleRange.every((v) => typeof v === "number"),
      JSON.stringify(eyeScaleRange)
    );
    if (!Array.isArray(eyeScaleRange)) {
      throw new Error("viewer-page.html has no eyeScaleFor; nothing to assert");
    }
    const [scaleMin, scaleDefault, scaleMax, exposedDefault] = eyeScaleRange;
    // The #36 default 0.58 and the #40 passes at 0.65, 0.72 and 0.76 all read
    // as too small on Maxwell's review; the 1.2 (14) fixed 0.70 (under a
    // stare lid) read as a bit large. The reference pass puts the default at
    // 0.82, the 1.2 (14) opening area with the iris top covered and inked.
    check(
      `default Eyes Size scales the eye past the too-small 0.58 / 0.65 / 0.72 / 0.76, over the 1.2 (14) fixed ${PREVIOUS_FIXED_EYE_SCALE} under a resting lid`,
      scaleDefault >= 0.8 &&
        scaleDefault <= 0.84 &&
        Math.abs(exposedDefault - scaleDefault) < 1e-9,
      `eyeScaleFor(0.5)=${scaleDefault} EYE_SCALE=${exposedDefault}`
    );
    // A beauty band, not a pinprick-to-saucer range: Size 0 is the old
    // 1.2 (14) eyeball under the heaviest lid, and Size 1 stays under the
    // unscaled GLB eye; the lid and iris carry the rest of the small/large
    // character.
    check(
      "Eyes Size min -> max spans a visible whole-eye beauty band",
      scaleMin >= 0.68 &&
        scaleMin <= 0.72 &&
        scaleMax - scaleMin >= 0.24 - 1e-9 &&
        scaleMax >= 0.92 &&
        scaleMax < 1 &&
        scaleMax <= EYE_SCALE_CEILING + 1e-9,
      `min=${scaleMin} max=${scaleMax}`
    );
    for (const entry of LOOKS) {
      await evaluate(
        cdp,
        sessionId,
        `window.applyLook(${JSON.stringify(entry.look)}); true`
      );
      await evaluate(
        cdp,
        sessionId,
        "new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(r, 80); }); }); })"
      );
      const state = await evaluate(cdp, sessionId, "window.phViewerState()");
      const wantScale = await evaluate(
        cdp,
        sessionId,
        `window.phViewerRig.eyeScaleFor(${JSON.stringify(entry.look.eyeSize)})`
      );
      assertLook(entry, state, wantScale);
      const shot = await cdp.send(
        "Page.captureScreenshot",
        { format: "png" },
        sessionId
      );
      const file = path.join(OUT_DIR, `${entry.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
      fs.writeFileSync(
        path.join(OUT_DIR, `${entry.name}.json`),
        JSON.stringify(state, null, 2)
      );
      console.log(`     screenshot ${file}`);
      const eyesFrame =
        state.meshes && state.meshes.Eyes_0 && state.meshes.Eyes_0.frame;
      if (eyesFrame && insideFrame(eyesFrame, 0)) {
        // 4x close-up of the eyes so a human can judge lids, iris and gaze
        // without a device.
        const clip = eyeClip(eyesFrame);
        const closeUp = await cdp.send(
          "Page.captureScreenshot",
          { format: "png", clip },
          sessionId
        );
        const eyesFile = path.join(OUT_DIR, `${entry.name}-eyes.png`);
        fs.writeFileSync(eyesFile, Buffer.from(closeUp.data, "base64"));
        console.log(`     close-up   ${eyesFile}`);
      }
    }
    // The complaint on 1.2 (14): Size min and max "barely differ" (Eyes_0
    // 31.2 -> 31.7 mm). The rendered eyeball at Size 1 must still be clearly
    // taller than at Size 0 (0.70 -> 0.94 is 1.34x nominal).
    const minHeight = eyeHeights[EYES_MIN_LOOK];
    const maxHeight = eyeHeights[EYES_MAX_LOOK];
    check(
      "Eyes Size max renders a clearly bigger eyeball than Size min",
      typeof minHeight === "number" &&
        typeof maxHeight === "number" &&
        maxHeight / minHeight >= 1.3,
      `Eyes_0 height min ${(minHeight * 1000).toFixed(1)} mm, max ${(
        maxHeight * 1000
      ).toFixed(1)} mm`
    );
    await pixelPass(cdp, sessionId);
  } finally {
    await cdp.close();
    server.close();
  }
  if (failures.length) {
    console.error(
      `\n${failures.length} check(s) failed:\n${failures.join("\n")}`
    );
    process.exit(1);
  }
  console.log(`\nAll checks passed. Screenshots in ${OUT_DIR}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
