#!/usr/bin/env node
/**
 * Renders assets/avatar-engine/viewer-page.html in headless Chrome (software
 * WebGL) and asserts what the 捏人 preview must show for every outfit: the
 * whole figure in frame, both hands drawn and on screen, the eyeball mesh
 * inside the head and scaled down with its bones by the look's Eyes Size
 * (eyeScaleFor: min clearly smaller than max, default under the old fixed
 * 0.70), both irises converged on the camera under a lowered upper lid, hair
 * on the head, one posed master skeleton. Screenshots (plus a 4x close-up of
 * the eyes) go to --out (default /tmp/ph-avatar-check) so a human can eyeball
 * the poses and the face.
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
// TestFlight 1.2 (14) shipped a fixed eye-bone scale; the default look must
// now sit clearly under it.
const PREVIOUS_FIXED_EYE_SCALE = 0.7;
// Rendered Eyes_0 height per look name, for the Size min/max spread check.
const eyeHeights = {};

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
  const lidDrop = state.eyes ? state.eyes.lidDrop : null;
  check(
    `${tag}: upper lid lowered off the startled rest pose`,
    typeof lidDrop === "number" && lidDrop >= 0.1 && lidDrop <= 0.27,
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
        wantScale < 0.9 &&
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
      Math.abs(height - want) < 0.002 && height < EYEBALL_DIAMETER * 0.85,
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
    check(
      `default Eyes Size scales the eye under the 1.2 (14) fixed ${PREVIOUS_FIXED_EYE_SCALE}`,
      scaleDefault <= PREVIOUS_FIXED_EYE_SCALE - 0.05 &&
        scaleDefault >= 0.5 &&
        Math.abs(exposedDefault - scaleDefault) < 1e-9,
      `eyeScaleFor(0.5)=${scaleDefault} EYE_SCALE=${exposedDefault}`
    );
    check(
      "Eyes Size min -> max spans a visible whole-eye scale range",
      scaleMin <= 0.5 && scaleMax - scaleMin >= 0.25 && scaleMax <= 0.85,
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
    // 31.2 -> 31.7 mm). The rendered eyeball at Size 1 must be at least half
    // again as tall as at Size 0.
    const minHeight = eyeHeights[EYES_MIN_LOOK];
    const maxHeight = eyeHeights[EYES_MAX_LOOK];
    check(
      "Eyes Size max renders a clearly bigger eyeball than Size min",
      typeof minHeight === "number" &&
        typeof maxHeight === "number" &&
        maxHeight / minHeight >= 1.5,
      `Eyes_0 height min ${(minHeight * 1000).toFixed(1)} mm, max ${(
        maxHeight * 1000
      ).toFixed(1)} mm`
    );
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
