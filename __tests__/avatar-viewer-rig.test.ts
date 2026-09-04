import fs from "fs";
import path from "path";
import vm from "vm";
import { beforeAll, describe, expect, it } from "@jest/globals";
import {
  CHARACTER_PRESETS,
  HAIR_STYLE_COUNT,
} from "../src/screens/avatar/engine/viewer-html";

/**
 * TestFlight 1.2 showed the BoZo companion with blank eye sockets, no hands
 * and arms folded through the torso; 1.2 (11) and (12) then showed saucer
 * irises under wide-open lids, staring parallel past the camera. All of it
 * lived in assets/avatar-engine/viewer-page.html, which the Release IPA
 * bundles verbatim. These tests run that exact script under Node with the
 * bundled three.min.js (no WebGL) and check the rig decisions it exposes on
 * window.phViewerRig, plus that the bundled copies cannot drift.
 */

const ROOT = path.join(__dirname, "..");
const ENGINE_DIR = path.join(ROOT, "assets", "avatar-engine");
const VIEWER_SOURCE = path.join(ENGINE_DIR, "viewer-page.html");
const BUNDLED_VIEWER_COPIES = [
  path.join(ROOT, "ios", "AppFrontend", "avatar-engine", "viewer-page.html"),
  path.join(
    ROOT,
    "android",
    "app",
    "src",
    "main",
    "assets",
    "avatar-engine",
    "viewer-page.html"
  ),
];

type Vec3 = [number, number, number];
type ArmTarget = {
  wrist: Vec3;
  pole: Vec3;
  hand?: Vec3;
  clavicleLift?: number;
};
type OutfitPose = { l: ArmTarget; r?: ArmTarget };
type Look = {
  appearanceIndex: number;
  hairStyle: number;
  revealBody?: boolean;
};

type ViewerRig = {
  SKIN_BY_OUTFIT: Record<number, Record<string, number>>;
  OUTFIT_POSES: OutfitPose[];
  MIN_PLAUSIBLE_HEIGHT: number;
  FALLBACK_HEIGHT: number;
  IRIS_RADIUS: number;
  PUPIL_RADIUS: number;
  UPPER_LID_DROP: number;
  MAX_GAZE_ANGLE: number;
  EYE_SCALE: number;
  EYE_SCALE_MIN: number;
  EYE_SCALE_MAX: number;
  eyeScaleFor: (eyeSize: number) => number;
  applyEyeScale: (bones: unknown[], scale: number) => void;
  upperLidDrop: (eyeSize: number) => number;
  aimBoneAt: (
    bone: unknown,
    rest: unknown,
    target: unknown,
    maxAngle: number
  ) => number;
  irisFragmentChunk: () => string;
  figureMeshVisible: (name: string, look: Look) => boolean;
  nameHasExposedSkin: (name: string, outfit: number) => boolean;
  isFigureMesh: (name: string) => boolean;
  isPoseArmBone: (name: string) => boolean;
  figureHeight: (measuredY: number) => number;
  sampleMeshPoint: (obj: unknown, index: number, target: unknown) => unknown;
  rigName: (obj: unknown) => string;
  retargetSkeletons: (root: unknown) => void;
  masterBoneNames: () => string[];
  solveElbow: (
    S: unknown,
    W: unknown,
    L1: number,
    L2: number,
    pole: Vec3,
    out: unknown
  ) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Three = any;

const OUTFIT_INDICES = CHARACTER_PRESETS.map(
  (preset) => preset.appearanceIndex
);

// The BoZo body kit as exported into bozo-male.glb.
const BODY_PARTS = [
  "Body_Ankle",
  "Body_Back",
  "Body_Chest",
  "Body_Foot",
  "Body_Hand",
  "Body_Hips",
  "Body_Leg",
  "Body_LowerArm",
  "Body_Neck",
  "Body_Shoulder",
  "Body_UpperArm",
  "Body_UpperLeg",
  "Body_Waist",
  "Body_Wrist",
];
const ALWAYS_COVERED = ["Body_Chest", "Body_Back", "Body_Hips", "Body_Waist"];

// Rest-pose segment lengths in metres (upperarm -> lowerarm -> hand).
const UPPER_ARM = 0.263;
const FOREARM = 0.224;

const loadViewer = () => {
  const html = fs.readFileSync(VIEWER_SOURCE, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]
  );
  expect(scripts).toHaveLength(1);
  const messages: string[] = [];
  const sandbox: Record<string, unknown> = {
    console,
    // No canvas: the viewer reports "Three.js failed to load" and stops
    // before touching WebGL, but every function and table is defined.
    document: {
      getElementById: () => null,
      createElement: () => ({ getContext: () => null }),
    },
    requestAnimationFrame: () => 0,
    ReactNativeWebView: { postMessage: (m: string) => messages.push(m) },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ENGINE_DIR, "three.min.js"), "utf8"),
    sandbox,
    { filename: "three.min.js" }
  );
  vm.runInContext(scripts[0], sandbox, { filename: "viewer-page.html" });
  return {
    rig: sandbox.phViewerRig as ViewerRig,
    THREE: sandbox.THREE as Three,
    messages,
  };
};

let rig: ViewerRig;
let THREE: Three;

beforeAll(() => {
  const loaded = loadViewer();
  rig = loaded.rig;
  THREE = loaded.THREE;
});

describe("bundled viewer copies", () => {
  it.each(BUNDLED_VIEWER_COPIES)(
    "%s is byte-identical to assets/avatar-engine/viewer-page.html",
    (copy) => {
      expect(fs.readFileSync(copy)).toEqual(fs.readFileSync(VIEWER_SOURCE));
    }
  );

  it("exposes the rig for tests and the headless check", () => {
    expect(rig).toBeDefined();
    expect(THREE.REVISION).toBe("128");
  });
});

describe("eyes", () => {
  it.each(OUTFIT_INDICES)(
    "draws the Eyes_0 eyeball mesh for outfit %i",
    (outfit) => {
      for (let hairStyle = 0; hairStyle < HAIR_STYLE_COUNT; hairStyle += 1) {
        expect(
          rig.figureMeshVisible("Eyes_0", {
            appearanceIndex: outfit,
            hairStyle,
          })
        ).toBe(true);
        expect(
          rig.figureMeshVisible("Head_0", {
            appearanceIndex: outfit,
            hairStyle,
          })
        ).toBe(true);
      }
    }
  );

  it("gives the iris material a polygon offset so the closed-eye cap in Head_0 cannot z-fight it", () => {
    const html = fs.readFileSync(VIEWER_SOURCE, "utf8");
    const iris = html.slice(html.indexOf("function upgradeIrisMat"));
    expect(iris).toMatch(/mat\.polygonOffset = true/);
    expect(iris).toMatch(/mat\.polygonOffsetFactor = -\d/);
  });

  it("paints the iris well inside the lid opening, with a pupil that reads as an iris rather than a black disc", () => {
    // Measured on bozo-male.glb: in the shader's units (d = angle / 90deg)
    // the rest lids uncover 0.26 above and 0.35 below the iris axis, 0.40 to
    // the nose and 0.66 to the temple. 1.2 (11) shipped irisR 0.58 (edge to
    // edge), 1.2 (12) shipped 0.40, still the full height of the aperture
    // with a black-disc pupil. The iris must stay inside the lower lid at
    // every Eyes-slider setting (irisSize 0.82..1.10) with sclera on both
    // sides, and the pupil must leave a wide iris band.
    expect(rig.IRIS_RADIUS * 1.1).toBeLessThan(0.35);
    // Still a cartoon eye, not a pinprick.
    expect(rig.IRIS_RADIUS * 0.82).toBeGreaterThan(0.22);
    const pupilToIris = rig.PUPIL_RADIUS / rig.IRIS_RADIUS;
    expect(pupilToIris).toBeGreaterThanOrEqual(0.3);
    expect(pupilToIris).toBeLessThanOrEqual(0.42);
  });

  it("compiles those radii into the eyeball shader and still paints the sclera", () => {
    const chunk = rig.irisFragmentChunk();
    expect(chunk).toContain(
      `float irisR = ${rig.IRIS_RADIUS.toFixed(3)} * irisSize;`
    );
    expect(chunk).toContain(
      `float pupilR = ${rig.PUPIL_RADIUS.toFixed(3)} * irisSize;`
    );
    // Eyes_0 stays a whole eyeball: white around the iris, not a bare iris.
    expect(chunk).toMatch(/vec3 scleraCol = /);
    expect(chunk).toContain("vec3 col = mix(scleraCol, irisCol, irisM);");
    expect(chunk).toContain("diffuseColor.rgb = col;");
    // No stale hard-coded radius left over from the oversized eyes.
    expect(chunk).not.toMatch(/0\.58\d* \* irisSize/);
    expect(chunk).not.toMatch(/0\.26\d* \* irisSize/);
    expect(chunk).not.toMatch(/0\.40\d* \* irisSize/);
    expect(chunk).not.toMatch(/0\.17\d* \* irisSize/);
  });

  it("shades the eyeball under the upper lid and lights both eyes from the same screen direction", () => {
    const chunk = rig.irisFragmentChunk();
    // 1.2 (12): a pure-white bead with a UV-fixed catchlight that mirrored
    // between the eyes. The sclera is no longer pure white, it darkens toward
    // the upper lid, and the catchlight comes from the view-space normal.
    expect(chunk).not.toContain("vec3(0.98, 0.99, 1.0)");
    expect(chunk).toMatch(/lidShade = smoothstep\([^)]*p\.y\)/);
    expect(chunk).toContain("scleraCol *= 1.0 - lidShade;");
    expect(chunk).toMatch(/dot\(vn, normalize\(vec3\(/);
    expect(chunk).not.toMatch(/length\(p - vec2\([^)]*\) \* irisR\)/);
    // Lifted unlit so the lower white does not go steel grey under the
    // purple hemisphere ground.
    expect(chunk).toMatch(/totalEmissiveRadiance \+= col \*/);
  });

  it("lowers the upper lid off the startled rest pose for every Eyes setting, never onto the pupil", () => {
    // Shape_EyeLidHeight on Head_0: 0 is the wide-open rest lid (+24deg above
    // the iris axis), ~0.27 puts the lid on the pupil, 0.45 on the iris
    // centre. Bigger Eyes open the lid a little, never all the way.
    const drops = [0, 0.25, 0.5, 0.75, 1].map((eye) => rig.upperLidDrop(eye));
    for (const drop of drops) {
      expect(drop).toBeGreaterThanOrEqual(0.1);
      expect(drop).toBeLessThanOrEqual(0.24);
    }
    for (let i = 1; i < drops.length; i += 1) {
      expect(drops[i]).toBeLessThan(drops[i - 1]);
    }
    expect(rig.upperLidDrop(0.5)).toBeCloseTo(rig.UPPER_LID_DROP - 0.04, 6);
    // Out-of-range slider values clamp instead of flipping the lid open.
    expect(rig.upperLidDrop(-3)).toBe(rig.upperLidDrop(0));
    expect(rig.upperLidDrop(9)).toBe(rig.upperLidDrop(1));
  });

  it("shrinks the default whole eye below the 1.2 (14) fixed 0.70 so a mid Size reads human-proportioned", () => {
    // TestFlight 1.2 (13): lowered lids, converged gaze and a 0.31 iris still
    // read as too-large eyes (整个眼睛的缩小, not another pupil shrink), so the
    // eye bones were scaled by a fixed 0.70. 1.2 (14): still "a bit large".
    // Eyes_0 is two 22.2 mm-radius spheres on eyeRoot_l/r - 44.4 mm across on
    // a 26 cm head; a real eye is 24 mm, i.e. 0.54. The default look (Eyes
    // Size 0.5) must sit clearly under the old 0.70 without becoming a
    // pinprick, and EYE_SCALE stays the name for that default.
    const PREVIOUS_FIXED_EYE_SCALE = 0.7;
    expect(rig.EYE_SCALE).toBeCloseTo(rig.eyeScaleFor(0.5), 9);
    expect(rig.EYE_SCALE).toBeLessThanOrEqual(PREVIOUS_FIXED_EYE_SCALE - 0.05);
    expect(rig.EYE_SCALE).toBeGreaterThanOrEqual(0.5);
    // Not 1.0 by a rounding accident.
    expect(rig.EYE_SCALE).not.toBeCloseTo(1, 1);
  });

  it("maps the Eyes Size slider onto a whole-eye scale range wide enough to see", () => {
    // 1.2 (14): Size only repainted the iris (irisSize 0.82..1.10) and opened
    // the lid by 0.08 while the eyeball stayed at 0.70 at every slider
    // position, so min and max looked the same (Eyes_0 31.2 -> 31.7 mm tall).
    // Size 0 must be clearly smaller than the old fixed eye, Size 1 may go a
    // little past it but never back toward the 1.0 saucer.
    const min = rig.eyeScaleFor(0);
    const max = rig.eyeScaleFor(1);
    expect(min).toBe(rig.EYE_SCALE_MIN);
    expect(max).toBe(rig.EYE_SCALE_MAX);
    expect(min).toBeLessThanOrEqual(0.5);
    expect(min).toBeGreaterThanOrEqual(0.35);
    expect(max).toBeGreaterThan(rig.EYE_SCALE);
    expect(max).toBeLessThanOrEqual(0.85);
    // The spread: the eye grows by at least half from min to max.
    expect(max - min).toBeGreaterThanOrEqual(0.25);
    expect(max / min).toBeGreaterThanOrEqual(1.5);
    // Monotonic and linear, so every slider step is the same visible step.
    const steps = [0, 0.25, 0.5, 0.75, 1].map((size) => rig.eyeScaleFor(size));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
      expect(steps[i] - steps[i - 1]).toBeCloseTo((max - min) / 4, 9);
    }
    // Out-of-range or missing slider values clamp instead of running past
    // the range or producing a NaN bone scale.
    expect(rig.eyeScaleFor(-2)).toBe(min);
    expect(rig.eyeScaleFor(7)).toBe(max);
    expect(rig.eyeScaleFor(NaN)).toBe(min);
  });

  it("re-applies the eye scale from the look's eyeSize whenever a look lands, not once at load", () => {
    // The 1.2 (14) viewer called applyEyeScale(eyeBones, EYE_SCALE) once after
    // retargetSkeletons and never again; applyLook (every slider drag from
    // AvatarEngineHost) only touched morphs and materials. The scale has to
    // follow the look, on load and on every applyLook, through eyeScaleFor.
    const html = fs.readFileSync(VIEWER_SOURCE, "utf8");
    const applyLookStart = html.indexOf("function applyLook(");
    const applyLookEnd = html.indexOf("function cameraDistance(");
    expect(applyLookStart).toBeGreaterThan(0);
    expect(applyLookEnd).toBeGreaterThan(applyLookStart);
    const applyLookBody = html.slice(applyLookStart, applyLookEnd);
    expect(applyLookBody).toMatch(
      /applyEyeScale\(eyeBones,\s*eyeScaleFor\(look\.eyeSize\)\)/
    );
    // Both the load path and applyLook go through the mapping; no fixed
    // constant is applied to the bones anywhere.
    expect(html).not.toMatch(/applyEyeScale\(eyeBones,\s*EYE_SCALE\)/);
    expect(html).toMatch(/applyEyeScale\(eyeBones,\s*eyeScaleFor\(/);
  });

  it("keeps the 1.2 (13) lid, gaze and iris constants: Size moves the eyeball scale, not the horror-eye fixes", () => {
    expect(rig.UPPER_LID_DROP).toBe(0.2);
    expect(rig.MAX_GAZE_ANGLE).toBe(0.24);
    expect(rig.IRIS_RADIUS).toBe(0.31);
    expect(rig.PUPIL_RADIUS).toBe(0.115);
    expect(rig.upperLidDrop(0)).toBeCloseTo(0.2, 9);
    expect(rig.upperLidDrop(0.5)).toBeCloseTo(0.16, 9);
    expect(rig.upperLidDrop(1)).toBeCloseTo(0.12, 9);
  });

  // A head bone with one eye bone under it and a three-vertex SkinnedMesh.
  // Vertex 0: on the eyeball surface, fully on the eye bone (Eyes_0 / the
  // Head_0 cap). Vertex 1: a lid-margin vertex 1.2 r out, weighted 0.8 eye /
  // 0.2 head like the BoZo lids. Vertex 2: brow skin on the head bone only.
  const skinnedEyeFixture = () => {
    const root = new THREE.Group();
    const head = new THREE.Bone();
    head.name = "head";
    head.position.set(0, 1.6, 0);
    const eye = new THREE.Bone();
    eye.name = "eyeRoot_l";
    eye.position.set(0.04, 0.07, 0.09);
    head.add(eye);
    root.add(head);
    root.updateMatrixWorld(true);
    const centre = eye.getWorldPosition(new THREE.Vector3());
    const r = 0.0222;
    const surface = centre.clone().add(new THREE.Vector3(0, 0, r));
    const lid = centre.clone().add(new THREE.Vector3(0, r * 1.2, 0));
    const brow = centre.clone().add(new THREE.Vector3(0, 0.03, 0.01));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...surface.toArray(), ...lid.toArray(), ...brow.toArray()],
        3
      )
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], 4)
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(
        [1, 0, 0, 0, 0.8, 0.2, 0, 0, 1, 0, 0, 0],
        4
      )
    );
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    const bones = [head, eye];
    const inverses = bones.map((b: Three) =>
      new THREE.Matrix4().copy(b.matrixWorld).invert()
    );
    mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    root.add(mesh);
    const skinned = (index: number) => {
      root.updateMatrixWorld(true);
      const out = new THREE.Vector3();
      mesh.boneTransform(index, out);
      return mesh.localToWorld(out);
    };
    return { root, head, eye, centre, r, brow, skinned };
  };

  it("applyEyeScale shrinks skinned eyeball vertices about the eye bone origin, blends lid vertices by weight and leaves the head alone", () => {
    const { head, eye, centre, r, brow, skinned } = skinnedEyeFixture();
    expect(skinned(0).distanceTo(centre)).toBeCloseTo(r, 6);

    rig.applyEyeScale([eye], rig.EYE_SCALE);

    expect(eye.scale.x).toBeCloseTo(rig.EYE_SCALE, 9);
    expect(eye.scale.y).toBeCloseTo(rig.EYE_SCALE, 9);
    expect(eye.scale.z).toBeCloseTo(rig.EYE_SCALE, 9);
    expect(head.scale.x).toBe(1);
    // The eye stays centred in its socket...
    expect(eye.getWorldPosition(new THREE.Vector3()).distanceTo(centre)).toBeLessThan(1e-9);
    // ...the ball shrinks about that centre...
    expect(skinned(0).distanceTo(centre)).toBeCloseTo(r * rig.EYE_SCALE, 6);
    // ...the lid follows by its weight (linear blend skinning), so the rig's
    // own eye weights become the shrink falloff...
    const lidRadius = skinned(1).distanceTo(centre);
    expect(lidRadius).toBeCloseTo(r * 1.2 * (1 - 0.8 * (1 - rig.EYE_SCALE)), 6);
    // ...and stays outside the smaller ball rather than sinking into it.
    expect(lidRadius).toBeGreaterThan(r * rig.EYE_SCALE);
    // Brow skin on the head bone does not move (Float32 positions: sub-micron).
    expect(skinned(2).distanceTo(brow)).toBeLessThan(1e-6);
    // Applying again is idempotent (absolute scale, not multiplied per frame).
    rig.applyEyeScale([eye], rig.EYE_SCALE);
    expect(eye.scale.x).toBeCloseTo(rig.EYE_SCALE, 9);
  });

  it.each([0, 0.5, 1])(
    "applyEyeScale at Eyes Size %d shrinks the ball to eyeScaleFor and keeps the lid margin outside it",
    (size) => {
      const scale = rig.eyeScaleFor(size);
      const { head, eye, centre, r, brow, skinned } = skinnedEyeFixture();
      rig.applyEyeScale([eye], scale);
      expect(eye.scale.x).toBeCloseTo(scale, 9);
      expect(head.scale.x).toBe(1);
      expect(
        eye.getWorldPosition(new THREE.Vector3()).distanceTo(centre)
      ).toBeLessThan(1e-9);
      expect(skinned(0).distanceTo(centre)).toBeCloseTo(r * scale, 6);
      const lidRadius = skinned(1).distanceTo(centre);
      expect(lidRadius).toBeCloseTo(r * 1.2 * (1 - 0.8 * (1 - scale)), 6);
      expect(lidRadius).toBeGreaterThan(r * scale);
      expect(skinned(2).distanceTo(brow)).toBeLessThan(1e-6);
    }
  );

  it("aiming the eye keeps the eyeball scale", () => {
    const eye = new THREE.Bone();
    eye.position.set(0.04, 1.67, 0.09);
    const rest = new THREE.Quaternion();
    rig.applyEyeScale([eye], rig.EYE_SCALE);
    eye.updateMatrixWorld(true);
    rig.aimBoneAt(eye, rest, new THREE.Vector3(0.1, 1.4, 1.8), rig.MAX_GAZE_ANGLE);
    expect(eye.scale.toArray()).toEqual([
      rig.EYE_SCALE,
      rig.EYE_SCALE,
      rig.EYE_SCALE,
    ]);
  });

  it("turns an eye bone's local +Z onto a world target, through a rotated parent, and clamps the turn", () => {
    const parent = new THREE.Object3D();
    parent.position.set(0, 1.6, 0);
    // Like the BoZo head bone, the parent is not axis-aligned and the eye's
    // rest quaternion compensates so the iris axis is world +Z: the aim has
    // to be solved in world space, not in the bone's local frame.
    parent.rotation.set(0.3, Math.PI / 2, -0.2);
    const bone = new THREE.Bone();
    bone.position.set(0.04, 0.07, 0.09);
    parent.add(bone);
    const rest = parent.quaternion.clone().invert();
    bone.quaternion.copy(rest);
    parent.updateMatrixWorld(true);
    const forward = () =>
      new THREE.Vector3(0, 0, 1)
        .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
    const restForward = forward();
    expect(restForward.angleTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
    const eye = bone.getWorldPosition(new THREE.Vector3());

    // A target a few degrees away is hit exactly.
    const near = eye.clone().add(new THREE.Vector3(0.1, -0.2, 1.7));
    const wantNear = near.clone().sub(eye).normalize();
    const turned = rig.aimBoneAt(bone, rest, near, rig.MAX_GAZE_ANGLE);
    expect(forward().angleTo(wantNear)).toBeLessThan(1e-6);
    expect(turned).toBeCloseTo(restForward.angleTo(wantNear), 6);
    expect(turned).toBeLessThan(rig.MAX_GAZE_ANGLE);

    // Re-aiming starts from rest again, so it does not accumulate.
    rig.aimBoneAt(bone, rest, near, rig.MAX_GAZE_ANGLE);
    expect(forward().angleTo(wantNear)).toBeLessThan(1e-6);

    // A target far off-axis is only approached by maxAngle.
    const far = eye.clone().add(new THREE.Vector3(0, -3, 0.2));
    const wantFar = far.clone().sub(eye).normalize();
    expect(rig.aimBoneAt(bone, rest, far, rig.MAX_GAZE_ANGLE)).toBeCloseTo(
      rig.MAX_GAZE_ANGLE,
      6
    );
    expect(forward().angleTo(restForward)).toBeCloseTo(rig.MAX_GAZE_ANGLE, 5);
    expect(forward().angleTo(wantFar)).toBeLessThan(
      restForward.angleTo(wantFar)
    );
  });

  it("converges both eyes on the bust and full cameras, looking down toward them", () => {
    // Eye centres and cameras as the viewer places them for a 1.80m figure
    // (frameCamera: bust at 0.82h looking at 0.80h, full at 0.5h).
    const h = 1.802;
    const cameras = {
      bust: new THREE.Vector3(h * 0.05, h * 0.82, 1.73),
      full: new THREE.Vector3(h * 0.06, h * 0.5, 4.6),
    };
    for (const cam of Object.values(cameras)) {
      const root = new THREE.Group();
      const left = new THREE.Bone();
      left.position.set(0.036, 1.666, 0.069);
      const right = new THREE.Bone();
      right.position.set(-0.046, 1.666, 0.069);
      root.add(left, right);
      root.updateMatrixWorld(true);
      const rest = new THREE.Quaternion();
      rig.aimBoneAt(left, rest, cam, rig.MAX_GAZE_ANGLE);
      rig.aimBoneAt(right, rest, cam, rig.MAX_GAZE_ANGLE);
      const fwd = (bone: Three) =>
        new THREE.Vector3(0, 0, 1)
          .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()))
          .normalize();
      const l = fwd(left);
      const r = fwd(right);
      const wantL = cam.clone().sub(left.position).normalize();
      const wantR = cam.clone().sub(right.position).normalize();
      // Neither camera needs more than the clamp, so both hit exactly.
      expect(l.angleTo(wantL)).toBeLessThan(1e-6);
      expect(r.angleTo(wantR)).toBeLessThan(1e-6);
      // Down toward the viewer (1.2 (12) stared level, above the camera)...
      expect(l.y).toBeLessThan(-0.1);
      expect(r.y).toBeLessThan(-0.1);
      // ...and converged: the right eye turns further toward +x than the left.
      expect(r.x).toBeGreaterThan(l.x + 0.005);
    }
    // The clamp leaves headroom over the steepest camera (full: ~9.4deg down
    // plus convergence) without letting the eye roll into the socket wall.
    expect(rig.MAX_GAZE_ANGLE).toBeGreaterThan(0.18);
    expect(rig.MAX_GAZE_ANGLE).toBeLessThan(0.35);
  });
});

describe("hands and exposed skin", () => {
  it.each(OUTFIT_INDICES)(
    "shows Body_Hand and Body_Neck for outfit %i",
    (outfit) => {
      expect(rig.SKIN_BY_OUTFIT[outfit]).toBeDefined();
      expect(rig.nameHasExposedSkin("Body_Hand", outfit)).toBe(true);
      expect(rig.nameHasExposedSkin("Body_Neck", outfit)).toBe(true);
      expect(
        rig.figureMeshVisible("Body_Hand", {
          appearanceIndex: outfit,
          hairStyle: 0,
        })
      ).toBe(true);
    }
  );

  it.each(OUTFIT_INDICES)(
    "keeps the torso skin under the outfit %i clothes",
    (outfit) => {
      for (const part of ALWAYS_COVERED) {
        expect(
          rig.figureMeshVisible(part, { appearanceIndex: outfit, hairStyle: 0 })
        ).toBe(false);
      }
    }
  );

  it("uncovers the arms only where the garment sleeves end", () => {
    // 0 short-sleeve shirt, 3 tank top: bare forearms. 1 jacket, 2 hoodie:
    // sleeves reach the hand bones, only the hands show.
    expect(rig.nameHasExposedSkin("Body_LowerArm", 0)).toBe(true);
    expect(rig.nameHasExposedSkin("Body_LowerArm", 3)).toBe(true);
    expect(rig.nameHasExposedSkin("Body_Shoulder", 3)).toBe(true);
    expect(rig.nameHasExposedSkin("Body_LowerArm", 1)).toBe(false);
    expect(rig.nameHasExposedSkin("Body_LowerArm", 2)).toBe(false);
    expect(rig.nameHasExposedSkin("Body_Shoulder", 0)).toBe(false);
  });

  it("reveals every body part when the Body sliders fade the clothes", () => {
    for (const part of BODY_PARTS) {
      expect(
        rig.figureMeshVisible(part, {
          appearanceIndex: 1,
          hairStyle: 1,
          revealBody: true,
        })
      ).toBe(true);
    }
  });

  it("switches hair and outfit meshes by index and never draws Icospheres", () => {
    const look = { appearanceIndex: 2, hairStyle: 1 };
    expect(rig.figureMeshVisible("Hair_1_0_0", look)).toBe(true);
    expect(rig.figureMeshVisible("Hair_1_1_0", look)).toBe(true);
    expect(rig.figureMeshVisible("Hair_0_0_0", look)).toBe(false);
    expect(rig.figureMeshVisible("Outfit_2_top_0", look)).toBe(true);
    expect(rig.figureMeshVisible("Outfit_3_top_0", look)).toBe(false);
    expect(rig.figureMeshVisible("Icosphere.001", look)).toBe(false);
  });
});

describe("outfit poses", () => {
  const length = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

  it("has one pose per outfit preset", () => {
    expect(rig.OUTFIT_POSES.length).toBeGreaterThanOrEqual(
      OUTFIT_INDICES.length
    );
  });

  it.each(OUTFIT_INDICES)(
    "outfit %i keeps both wrists reachable and in front of the body plane",
    (outfit) => {
      const pose = rig.OUTFIT_POSES[outfit];
      for (const side of [pose.l, pose.r || pose.l]) {
        const reach = length(side.wrist);
        expect(reach).toBeLessThan(UPPER_ARM + FOREARM);
        expect(reach).toBeGreaterThan(Math.abs(UPPER_ARM - FOREARM));
        // The shoulder joint sits at z = -0.036; anything below -0.03 puts
        // the hand behind the back where the camera cannot see it.
        expect(side.wrist[2]).toBeGreaterThan(0);
        // Hands stay below the top of the head (1.80 - 1.45 shoulder).
        expect(side.wrist[1]).toBeLessThan(0.3);
      }
    }
  );

  it("gives the four outfits four different poses", () => {
    const keys = OUTFIT_INDICES.map((outfit) =>
      JSON.stringify(rig.OUTFIT_POSES[outfit])
    );
    expect(new Set(keys).size).toBe(OUTFIT_INDICES.length);
  });

  it("solves the elbow on both segment lengths and toward the pole", () => {
    const S = new THREE.Vector3(0.131, 1.453, -0.036);
    const W = new THREE.Vector3(0.231, 1.033, 0.054);
    const E = new THREE.Vector3();
    rig.solveElbow(S, W, UPPER_ARM, FOREARM, [0.6, 0, -0.8], E);
    expect(E.distanceTo(S)).toBeCloseTo(UPPER_ARM, 3);
    expect(E.distanceTo(W)).toBeCloseTo(FOREARM, 3);
    // Elbow pole points back and out: the elbow ends up behind the S->W line.
    expect(E.z).toBeLessThan(Math.min(S.z, W.z) + 0.02);
  });

  it("poses clavicle, upper arm, forearm and hand but not twist helpers or fingers", () => {
    expect(rig.isPoseArmBone("upperarm_l")).toBe(true);
    expect(rig.isPoseArmBone("lowerarm_r")).toBe(true);
    expect(rig.isPoseArmBone("hand_l")).toBe(true);
    expect(rig.isPoseArmBone("clavicle_r")).toBe(true);
    expect(rig.isPoseArmBone("upperarm_twist_01_l")).toBe(false);
    expect(rig.isPoseArmBone("lowerarm_twist_02_r")).toBe(false);
    expect(rig.isPoseArmBone("index_01_l")).toBe(false);
    expect(rig.isPoseArmBone("middle_metacarpal_r")).toBe(false);
    expect(rig.isPoseArmBone("thumb_02_l")).toBe(false);
  });
});

describe("framing", () => {
  it("measures skinned meshes through the skeleton, not raw positions", () => {
    const target = new THREE.Vector3();
    const skinned = {
      isSkinnedMesh: true,
      boneTransform: (_index: number, out: Three) => out.set(0.1, 1.7, 0.05),
      localToWorld: (v: Three) => v,
      geometry: {
        attributes: {
          position: new THREE.Float32BufferAttribute([5, 6, 7], 3),
        },
      },
    };
    rig.sampleMeshPoint(skinned, 0, target);
    expect(target.toArray()).toEqual([0.1, 1.7, 0.05]);

    const plain = {
      isSkinnedMesh: false,
      localToWorld: (v: Three) => v,
      geometry: {
        attributes: {
          position: new THREE.Float32BufferAttribute([5, 6, 7], 3),
        },
      },
    };
    rig.sampleMeshPoint(plain, 0, target);
    expect(target.toArray()).toEqual([5, 6, 7]);
  });

  it("frames a nominal adult when the measured box is not a standing figure", () => {
    // Raw skinned positions * matrixWorld made BoZo 0.003 tall; that used to
    // clamp to 0.8 and point the camera at the shins.
    expect(rig.figureHeight(0.003)).toBe(rig.FALLBACK_HEIGHT);
    expect(rig.figureHeight(0.8)).toBe(rig.FALLBACK_HEIGHT);
    expect(rig.figureHeight(1.802)).toBe(1.802);
    expect(rig.FALLBACK_HEIGHT).toBeGreaterThanOrEqual(
      rig.MIN_PLAUSIBLE_HEIGHT
    );
  });

  it("treats hair as part of the figure", () => {
    for (const name of [
      "Body_Hand",
      "Head_0",
      "Eyes_0",
      "Outfit_1_top_0",
      "Hair_2_1_0",
    ]) {
      expect(rig.isFigureMesh(name)).toBe(true);
    }
    expect(rig.isFigureMesh("")).toBe(false);
  });
});

describe("skeleton retargeting", () => {
  // GLTFLoader keeps the glTF name in userData.name and suffixes duplicates.
  const bone = (gltfName: string, suffix: string, position: Vec3) => {
    const b = new THREE.Bone();
    b.name = gltfName + suffix;
    b.userData.name = gltfName;
    b.position.set(position[0], position[1], position[2]);
    return b;
  };

  const skinnedMesh = (root: Three, bones: Three[], vertex: Vec3) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertex, 3)
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute([bones.length - 1, 0, 0, 0], 4)
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0], 4)
    );
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    root.updateMatrixWorld(true);
    const inverses = bones.map((b: Three) =>
      new THREE.Matrix4().copy(b.matrixWorld).invert()
    );
    mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    return mesh;
  };

  it("reads the glTF bone name back through GLTFLoader's unique suffix", () => {
    expect(rig.rigName(bone("hand_l", "_2", [0, 0, 0]))).toBe("hand_l");
    expect(rig.rigName({ name: "hand_l" })).toBe("hand_l");
  });

  it("drives a displaced hair rig from the master skeleton so the hair sits on the head", () => {
    const root = new THREE.Group();
    // Master armature (the one with the most bones, like the 74-joint eye
    // rig in the GLB), standing at the origin.
    const pelvis = bone("pelvis", "", [0, 1, 0]);
    const neck = bone("neck_02", "", [0, 0.5, 0]);
    const head = bone("head", "", [0, 0.1, 0]);
    const jaw = bone("Jaw", "", [0, -0.05, 0.05]);
    const eye = bone("eyeRoot_l", "", [0.04, 0.05, 0.08]);
    pelvis.add(neck);
    neck.add(head);
    head.add(jaw);
    head.add(eye);
    root.add(pelvis);
    // Hair-back armature exported 1.4 m to the side (skins 3/6/10 in the
    // GLB): pelvis..neck_02 only, mesh weighted to neck_02.
    const pelvis1 = bone("pelvis", "_1", [-1.4, 1, 0]);
    const neck1 = bone("neck_02", "_1", [0, 0.5, 0]);
    pelvis1.add(neck1);
    root.add(pelvis1);
    // Hair-front armature in the right place with a hair-only bone whose
    // rest orientation differs from the master head (skin 5).
    const pelvis2 = bone("pelvis", "_2", [0, 1, 0]);
    const neck2 = bone("neck_02", "_2", [0, 0.5, 0]);
    const head2 = bone("head", "_2", [0, 0.1, 0]);
    head2.rotation.set(0, Math.PI / 2, 0);
    const hairFront = bone("HairFront", "", [0.05, 0.15, 0]);
    pelvis2.add(neck2);
    neck2.add(head2);
    head2.add(hairFront);
    root.add(pelvis2);

    const headMesh = skinnedMesh(root, [pelvis, neck, head], [0, 1.6, 0.05]);
    headMesh.name = "Head_0";
    root.add(headMesh);
    // Vertex sits where the displaced rig's neck_02 is in the bind pose.
    const hairBack = skinnedMesh(root, [pelvis1, neck1], [-1.4, 1.5, 0]);
    hairBack.name = "Hair_0_0_0";
    root.add(hairBack);
    root.updateMatrixWorld(true);
    const hairFrontRest = hairFront.getWorldPosition(new THREE.Vector3());
    const hairFrontMesh = skinnedMesh(
      root,
      [pelvis2, neck2, head2, hairFront],
      hairFrontRest.toArray()
    );
    hairFrontMesh.name = "Hair_1_0_0";
    root.add(hairFrontMesh);

    rig.retargetSkeletons(root);

    expect(rig.masterBoneNames()).toEqual([
      "pelvis",
      "neck_02",
      "head",
      "Jaw",
      "eyeRoot_l",
    ]);
    expect(headMesh.skeleton.bones).toEqual([pelvis, neck, head]);
    expect(hairBack.skeleton.bones).toEqual([pelvis, neck]);
    // Shared names resolve to the master bones; HairFront keeps its own bone,
    // now hanging under the master head so it follows the idle head motion.
    expect(hairFrontMesh.skeleton.bones.slice(0, 3)).toEqual([
      pelvis,
      neck,
      head,
    ]);
    expect(hairFrontMesh.skeleton.bones[3]).toBe(hairFront);
    expect(hairFront.parent).toBe(head);

    root.updateMatrixWorld(true);
    const world = new THREE.Vector3();
    hairBack.boneTransform(0, world);
    hairBack.localToWorld(world);
    // Was at x = -1.4 (off the body); now on the master neck.
    expect(world.x).toBeCloseTo(0, 5);
    expect(world.y).toBeCloseTo(1.5, 5);
    expect(world.z).toBeCloseTo(0, 5);
    // Re-attaching under the master head keeps the hair where it was.
    hairFrontMesh.boneTransform(0, world);
    hairFrontMesh.localToWorld(world);
    expect(world.distanceTo(hairFrontRest)).toBeLessThan(1e-5);
    expect(
      hairFront.getWorldPosition(new THREE.Vector3()).distanceTo(hairFrontRest)
    ).toBeLessThan(1e-5);
  });
});
