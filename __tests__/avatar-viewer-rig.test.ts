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
 * and arms folded through the torso. All three lived in
 * assets/avatar-engine/viewer-page.html, which the Release IPA bundles
 * verbatim. These tests run that exact script under Node with the bundled
 * three.min.js (no WebGL) and check the rig decisions it exposes on
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
