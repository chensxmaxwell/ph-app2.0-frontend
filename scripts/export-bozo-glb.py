"""Assemble a BoZo male GLB for the PH avatar viewer.

Pose each imported armature into a relaxed A-pose, then apply the Armature
modifier into vertex positions while preserving Shape_* keys. Unity ID maps
are recolored into garment palettes; body/head use a generated skin albedo.
Skins and animations are not exported.
"""
from __future__ import annotations

from math import radians
from pathlib import Path
import random
import re
import sys

import bpy
from mathutils import Matrix, Vector

try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

ROOT = Path("/Users/maxwell/Downloads/BoZo_StylizedModularCharacters")
OUT = Path("/Users/maxwell/Downloads/ph-app2.0-frontend-main/assets/avatar-engine/bozo-male.glb")

BODY = ROOT / "Outfits/Common/Body/Body_BasicBodyV2/Body_BasicBodyV2.fbx"
HEAD = ROOT / "Outfits/Common/BSMC_Head/Head_V2/Head_V2.fbx"
EYES = ROOT / "Outfits/Common/Eyes/Eyes_BasicEyes.fbx"

HAIRS = [
    (
        ROOT / "Outfits/Base/HairFront/Outfit_FrontHair_Quickly/BSMC_Outfit_HairFront_QuicklyHair.fbx",
        ROOT / "Outfits/Base/HairBack/Outfit_HairBack_Buzzed/BSMC_Outfit_HairBack_Buzzed.fbx",
    ),
    (
        ROOT / "Outfits/Base/HairFront/Outfit_HairFront_SweaptBack/BSMC_Outfit_HairFront_SweaptBack.fbx",
        ROOT / "Outfits/Base/HairBack/Outfit_HairBack_Short/BSMC_Outfit_HairBack_Short.fbx",
    ),
    (
        ROOT / "Outfits/Base/HairFront/Outfit_HairFront_LongSweeps/BSMC_Outfit_HairFront_LongSweeps.fbx",
        ROOT / "Outfits/Base/HairBack/Outfit_HairBack_LongStreight/BSMC_Outfit_HairBack_LongStreight.fbx",
    ),
    (
        ROOT / "Outfits/Base/HairFront/Outfit_FrontHair_Fohawk/BSMC_Outfit_HairFront_Fohawk.fbx",
        ROOT / "Outfits/Base/HairBack/Outfit_HairBack_Punk/BSMC_Outfit_HairBack_Punk.fbx",
    ),
]

OUTFITS = [
    (
        ROOT / "Outfits/Base/Top/Outfit_Top_Shirt/Outfit_Top_Shirt.fbx",
        ROOT / "Outfits/Base/Bottom/Outfit_Bottom_Jeans/BSMC_Bottom_Jeans.fbx",
        ROOT / "Outfits/Base/Feet/Outfit_Feet_SportsShoes/BMSC_Outfit_Feet_SportsShoes.fbx",
    ),
    (
        ROOT / "Outfits/Base/Top/Outfit_Top_CasualJacket/BSMC_Outfit_Top_CasualJacket.fbx",
        ROOT / "Outfits/Base/Bottom/Outfit_Bottom_CargoPants/BSMC_Outfit_Bottom_CargoPants.fbx",
        ROOT / "Outfits/Base/Feet/Outfit_Feet_WorkBoots/BMSC_Outfit_Feet_WorkBoots.fbx",
    ),
    (
        ROOT / "Outfits/Base/Top/Outfit_Top_Hoodie/BSMC_Outfit_Top_Hoodie.fbx",
        ROOT / "Outfits/Base/Bottom/Outfit_Bottom_BaggyPantsLong/BMSC_Outfit_Bottom_BaggyPantsLong.fbx",
        ROOT / "Outfits/Base/Feet/Outfit_Feet_StreetShoes/BMSC_Outfit_Feet_StreetShoes.fbx",
    ),
    (
        ROOT / "Outfits/Base/Top/Outfit_Top_TankTop/BSMC_TankTop.fbx",
        ROOT / "Outfits/Base/Bottom/Outfit_Bottom_DressPants/BSMC_Outfit_Bottom_DressPants.fbx",
        ROOT / "Outfits/Base/Feet/Outfit_Feet_ComfyShoes/BSMC_Outfit_Feet_ComfyShoes.fbx",
    ),
]

# (red_region, green_region, blue_region) as linear-ish sRGB 0-1 triples.
OUTFIT_PALETTES = {
    0: {
        "top": ((0.93, 0.90, 0.84), (0.82, 0.79, 0.73), (0.72, 0.69, 0.64)),
        "bottom": ((0.17, 0.27, 0.46), (0.12, 0.18, 0.34), (0.09, 0.13, 0.26)),
        "feet": ((0.95, 0.95, 0.95), (0.12, 0.11, 0.10), (0.18, 0.17, 0.16)),
    },
    1: {
        "top": ((0.40, 0.46, 0.26), (0.30, 0.34, 0.18), (0.24, 0.28, 0.16)),
        "bottom": ((0.68, 0.62, 0.40), (0.52, 0.47, 0.30), (0.42, 0.37, 0.24)),
        "feet": ((0.28, 0.17, 0.11), (0.14, 0.09, 0.06), (0.10, 0.07, 0.05)),
    },
    2: {
        "top": ((0.27, 0.27, 0.29), (0.16, 0.16, 0.18), (0.45, 0.52, 0.62)),
        "bottom": ((0.15, 0.15, 0.17), (0.10, 0.10, 0.12), (0.08, 0.08, 0.10)),
        "feet": ((0.07, 0.07, 0.07), (0.92, 0.92, 0.92), (0.88, 0.88, 0.88)),
    },
    3: {
        "top": ((0.20, 0.23, 0.28), (0.16, 0.18, 0.22), (0.14, 0.16, 0.20)),
        "bottom": ((0.07, 0.07, 0.07), (0.04, 0.04, 0.04), (0.05, 0.05, 0.05)),
        "feet": ((0.76, 0.62, 0.45), (0.42, 0.30, 0.20), (0.55, 0.42, 0.30)),
    },
}

BODY_NAME_MAP = {
    "ankles": "Body_Ankle",
    "ankle": "Body_Ankle",
    "back": "Body_Back",
    "chest": "Body_Chest",
    "feet": "Body_Foot",
    "foot": "Body_Foot",
    "hands": "Body_Hand",
    "hand": "Body_Hand",
    "hand_l": "Body_Hand_L",
    "hand_r": "Body_Hand_R",
    "hips": "Body_Hips",
    "hip": "Body_Hips",
    "lowerarms": "Body_LowerArm",
    "lowerarm": "Body_LowerArm",
    "lowerlegs": "Body_Leg",
    "lowerleg": "Body_Leg",
    "leg": "Body_Leg",
    "neck": "Body_Neck",
    "shoulders": "Body_Shoulder",
    "shoulder": "Body_Shoulder",
    "upperarms": "Body_UpperArm",
    "upperarm": "Body_UpperArm",
    "upperlegs": "Body_UpperLeg",
    "upperleg": "Body_UpperLeg",
    "waist": "Body_Waist",
    "wrists": "Body_Wrist",
    "wrist": "Body_Wrist",
}

GENERIC_MESH_NAMES = {
    "mesh",
    "cube",
    "sphere",
    "plane",
    "object",
    "body",
    "geo",
    "geometry",
}

A_POSE_APPLIED = False
A_POSE_BONES: list[str] = []


def strip_numeric_suffix(name: str) -> str:
    return re.sub(r"\.\d+$", "", name)


def find_albedo(fbx_path: Path) -> Path | None:
    folder = fbx_path.parent
    pngs = list(folder.glob("*.png"))
    for pattern in ("*_D.png", "*_D.PNG", "*Diffuse*", "*Albedo*"):
        hits = list(folder.glob(pattern))
        if hits:
            return hits[0]
    skip = ("_N.png", "_S.png", "_ID.png", "_M.png", "Icon")
    for png in pngs:
        name = png.name
        if any(token in name for token in skip):
            continue
        return png
    return pngs[0] if pngs else None


def make_skin_image(name: str, size: int = 512) -> bpy.types.Image:
    """Light peach albedo with slight noise/AO so viewer skin tints still work."""
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    pixels = [0.0] * (size * size * 4)
    rng = random.Random(7)
    base = (0.96, 0.88, 0.80)
    for y in range(size):
        for x in range(size):
            nx = x / size - 0.5
            ny = y / size - 0.5
            ao = 1.0 - 0.07 * min(1.0, (nx * nx + ny * ny) * 3.2)
            grain = 1.0 + (rng.random() - 0.5) * 0.035
            shade = ao * grain
            index = (y * size + x) * 4
            pixels[index] = min(1.0, base[0] * shade)
            pixels[index + 1] = min(1.0, base[1] * shade)
            pixels[index + 2] = min(1.0, base[2] * shade)
            pixels[index + 3] = 1.0
    image.pixels.foreach_set(pixels)
    image.colorspace_settings.name = "sRGB"
    image.update()
    # Pack pixels as PNG. Default pack() keeps an empty/original file and
    # glTF export then writes a black JPEG or the Unity ID map.
    image.pack(as_png=True)
    return image


def recolor_id_image(
    src: bpy.types.Image,
    palette: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]],
    dest_name: str,
    size: int = 512,
    keep_white: bool = True,
) -> bpy.types.Image:
    """Replace Unity RGB ID regions with garment colors. Near-black stays black."""
    width, height = src.size
    count = width * height * 4
    pixels = [0.0] * count
    src.pixels.foreach_get(pixels)
    color_r, color_g, color_b = palette
    for index in range(0, count, 4):
        red = pixels[index]
        green = pixels[index + 1]
        blue = pixels[index + 2]
        maximum = red if red > green else green
        if blue > maximum:
            maximum = blue
        minimum = red if red < green else green
        if blue < minimum:
            minimum = blue
        if maximum < 0.08:
            pixels[index] = 0.0
            pixels[index + 1] = 0.0
            pixels[index + 2] = 0.0
            continue
        if keep_white and minimum > 0.88 and (maximum - minimum) < 0.10:
            continue
        pixels[index] = min(1.0, red * color_r[0] + green * color_g[0] + blue * color_b[0])
        pixels[index + 1] = min(1.0, red * color_r[1] + green * color_g[1] + blue * color_b[1])
        pixels[index + 2] = min(1.0, red * color_r[2] + green * color_g[2] + blue * color_b[2])
    image = bpy.data.images.new(dest_name, width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels)
    if size and (width != size or height != size):
        image.scale(size, size)
    image.colorspace_settings.name = "sRGB"
    image.update()
    image.pack(as_png=True)
    return image


def make_material(
    name: str,
    image: bpy.types.Image | None,
    tintable: bool,
    alpha_hashed: bool = False,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if image is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_hashed and "Alpha" in tex.outputs:
            links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.blend_method = "HASHED"
            if hasattr(mat, "shadow_method"):
                mat.shadow_method = "HASHED"
    if tintable:
        mat["phTint"] = 1
    bsdf.inputs["Roughness"].default_value = 0.48
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def load_image(path: Path) -> bpy.types.Image | None:
    if not path or not path.exists():
        return None
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    return image


def import_fbx(path: Path) -> list[bpy.types.Object]:
    if not path.exists():
        print("MISSING", path)
        return []
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(
        filepath=str(path),
        ignore_leaf_bones=True,
        automatic_bone_orientation=True,
        use_anim=False,
    )
    return [obj for obj in bpy.data.objects if obj not in before]


def mesh_objects(objs: list[bpy.types.Object]) -> list[bpy.types.Object]:
    meshes: list[bpy.types.Object] = []
    for obj in objs:
        try:
            if obj.type != "MESH" or "Icosphere" in obj.name:
                continue
        except ReferenceError:
            continue
        if len(obj.data.polygons) == 0:
            continue
        meshes.append(obj)
    with_armature = [
        obj
        for obj in meshes
        if any(modifier.type == "ARMATURE" for modifier in obj.modifiers)
    ]
    if with_armature:
        meshes = with_armature
    best: dict[str, bpy.types.Object] = {}
    for obj in meshes:
        key = strip_numeric_suffix(obj.name)
        previous = best.get(key)
        if previous is None or len(obj.data.vertices) > len(previous.data.vertices):
            best[key] = obj
    return list(best.values())


def keep_world(obj: bpy.types.Object, parent: bpy.types.Object | None) -> None:
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def prune_shape_keys(obj: bpy.types.Object) -> None:
    if obj.type != "MESH" or not obj.data.shape_keys:
        return
    for key_name in [block.name for block in obj.data.shape_keys.key_blocks]:
        if key_name == "Basis" or key_name.startswith("Shape_"):
            continue
        block = obj.data.shape_keys.key_blocks.get(key_name)
        if block is not None:
            obj.shape_key_remove(block)


def object_mode() -> None:
    if bpy.ops.object.mode_set.poll():
        bpy.ops.object.mode_set(mode="OBJECT")


def activate(obj: bpy.types.Object) -> None:
    object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def rotate_pose_bone_world(arm_obj: bpy.types.Object, bone_name: str, axis: str, angle: float) -> bool:
    bone = arm_obj.pose.bones.get(bone_name)
    if bone is None:
        return False
    bone.rotation_mode = "QUATERNION"
    head_world = arm_obj.matrix_world @ bone.head
    rotation = Matrix.Rotation(angle, 4, axis)
    origin = Matrix.Translation(head_world)
    world = arm_obj.matrix_world @ bone.matrix
    new_world = origin @ rotation @ origin.inverted() @ world
    bone.matrix = arm_obj.matrix_world.inverted() @ new_world
    return True


def pose_a_pose(arm_obj: bpy.types.Object) -> None:
    """Drop T-pose arms into a relaxed A-pose on Epic-style upperarm/lowerarm bones."""
    global A_POSE_APPLIED, A_POSE_BONES
    if arm_obj.type != "ARMATURE":
        return
    arm_obj.data.pose_position = "POSE"
    activate(arm_obj)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="DESELECT")
    hits: list[str] = []
    # Character is Z-up after FBX import. +Y rotation drops the +X (left) arm.
    for bone_name, axis, angle in (
        ("upperarm_l", "Y", radians(42)),
        ("upperarm_r", "Y", radians(-42)),
        ("lowerarm_l", "Y", radians(8)),
        ("lowerarm_r", "Y", radians(-8)),
        ("lowerarm_l", "Z", radians(-12)),
        ("lowerarm_r", "Z", radians(12)),
    ):
        if rotate_pose_bone_world(arm_obj, bone_name, axis, angle):
            hits.append(f"{bone_name}:{axis}")
    object_mode()
    bpy.context.view_layer.update()
    if hits:
        A_POSE_APPLIED = True
        A_POSE_BONES.extend(hits)
        print("A-POSE bones on", arm_obj.name, hits)


def collapse_shapekey_mix(obj: bpy.types.Object) -> None:
    if not obj.data.shape_keys:
        return
    obj.shape_key_add(name="_mix", from_mix=True)
    for block in list(obj.data.shape_keys.key_blocks):
        if block.name != "_mix":
            obj.shape_key_remove(block)
    remaining = obj.data.shape_keys.key_blocks.get("_mix")
    if remaining is not None:
        obj.shape_key_remove(remaining)


def apply_armature_modifiers(obj: bpy.types.Object) -> None:
    activate(obj)
    for modifier in list(obj.modifiers):
        if modifier.type != "ARMATURE":
            continue
        with bpy.context.temp_override(
            object=obj,
            active_object=obj,
            selected_objects=[obj],
        ):
            bpy.ops.object.modifier_apply(modifier=modifier.name)


def duplicate_current(obj: bpy.types.Object) -> bpy.types.Object:
    activate(obj)
    bpy.ops.object.duplicate()
    dup = bpy.context.active_object
    if dup is None or dup == obj:
        raise RuntimeError(f"duplicate failed for {obj.name}")
    return dup


def replace_with_posed(original: bpy.types.Object, posed: bpy.types.Object) -> bpy.types.Object:
    materials = list(original.data.materials)
    parent = original.parent
    world = original.matrix_world.copy()
    old_name = original.name
    bpy.data.objects.remove(original, do_unlink=True)
    posed.name = old_name
    posed.data.name = old_name
    posed.parent = parent
    posed.matrix_world = world
    posed.data.materials.clear()
    for mat in materials:
        posed.data.materials.append(mat)
    return posed


def apply_armature_preserve_shapekeys(obj: bpy.types.Object) -> bpy.types.Object:
    """Pose-deform verts, keeping Shape_* keys via duplicate-per-key."""
    if not any(modifier.type == "ARMATURE" for modifier in obj.modifiers):
        return obj

    shape_names: list[str] = []
    has_any_keys = obj.data.shape_keys is not None
    if has_any_keys:
        for block in obj.data.shape_keys.key_blocks:
            block.value = 0.0
        shape_names = [
            block.name
            for block in obj.data.shape_keys.key_blocks
            if block.name != "Basis" and block.name.startswith("Shape_")
        ]
    bpy.context.view_layer.update()

    if not has_any_keys:
        apply_armature_modifiers(obj)
        return obj

    def posed_copy() -> bpy.types.Object:
        dup = duplicate_current(obj)
        collapse_shapekey_mix(dup)
        apply_armature_modifiers(dup)
        return dup

    basis = posed_copy()
    if not shape_names:
        return replace_with_posed(obj, basis)

    basis.shape_key_add(name="Basis")
    n_verts = len(basis.data.vertices)
    for key_name in shape_names:
        for block in obj.data.shape_keys.key_blocks:
            block.value = 1.0 if block.name == key_name else 0.0
        bpy.context.view_layer.update()
        posed = posed_copy()
        key = basis.shape_key_add(name=key_name)
        if len(posed.data.vertices) != n_verts:
            print("VERT MISMATCH", obj.name, key_name, n_verts, len(posed.data.vertices))
        else:
            for index, vertex in enumerate(posed.data.vertices):
                key.data[index].co = vertex.co
        bpy.data.objects.remove(posed, do_unlink=True)

    if obj.data.shape_keys:
        for block in obj.data.shape_keys.key_blocks:
            block.value = 0.0
    return replace_with_posed(obj, basis)


def cleanup_mesh(obj: bpy.types.Object, avatar: bpy.types.Object) -> None:
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    obj.vertex_groups.clear()
    if obj.animation_data:
        obj.animation_data_clear()
    prune_shape_keys(obj)
    keep_world(obj, avatar)


def delete_non_meshes(objs: list[bpy.types.Object]) -> None:
    for obj in list(objs):
        try:
            if obj.name == "Avatar":
                continue
        except ReferenceError:
            continue
        keep = False
        try:
            keep = obj.type == "MESH" and "Icosphere" not in obj.name
        except ReferenceError:
            keep = False
        if keep:
            continue
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except ReferenceError:
            pass


def process_import(path: Path, avatar: bpy.types.Object) -> list[bpy.types.Object]:
    objs = import_fbx(path)
    print(
        "PRE names",
        path.name,
        [
            f"{obj.name}:{obj.type}"
            + (
                f":keys={[kb.name for kb in obj.data.shape_keys.key_blocks][:8]}"
                if obj.type == "MESH" and obj.data.shape_keys
                else ""
            )
            for obj in objs
        ],
    )
    for arm in [obj for obj in objs if obj.type == "ARMATURE"]:
        pose_a_pose(arm)
    meshes = mesh_objects(objs)
    processed: list[bpy.types.Object] = []
    for mesh in meshes:
        processed.append(apply_armature_preserve_shapekeys(mesh))
    for mesh in processed:
        cleanup_mesh(mesh, avatar)
    delete_non_meshes(objs)
    return processed


def assign_mat(objs: list[bpy.types.Object], mat: bpy.types.Material) -> None:
    for obj in objs:
        if obj.type != "MESH":
            continue
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def rename_meshes(objs: list[bpy.types.Object], prefix: str) -> None:
    for index, obj in enumerate(mesh_objects(objs)):
        obj.name = f"{prefix}_{index}"
        obj.data.name = obj.name


def mesh_world_center(obj: bpy.types.Object) -> Vector:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    acc = Vector((0.0, 0.0, 0.0))
    for point in points:
        acc += point
    return acc / max(1, len(points))


def rename_body_meshes(objs: list[bpy.types.Object]) -> None:
    meshes = mesh_objects(objs)
    if not meshes:
        return
    used: set[str] = set()

    def unique(name: str) -> str:
        candidate = name
        suffix = 1
        while candidate in used or (
            candidate in bpy.data.objects and bpy.data.objects[candidate] not in meshes
        ):
            candidate = f"{name}_{suffix}"
            suffix += 1
        used.add(candidate)
        return candidate

    def is_generic(obj: bpy.types.Object) -> bool:
        raw = strip_numeric_suffix(obj.name).lower()
        if raw in GENERIC_MESH_NAMES:
            return True
        if raw in BODY_NAME_MAP:
            return False
        return not any(token in raw for token in BODY_NAME_MAP)

    generic = [obj for obj in meshes if is_generic(obj)]
    named_by_box = bool(meshes) and len(generic) == len(meshes)

    if named_by_box:
        ranked = []
        for obj in meshes:
            min_corner, max_corner = world_bbox([obj])
            size = max_corner - min_corner
            center = mesh_world_center(obj)
            ranked.append((obj, center, size))
        if not ranked:
            return
        height_span = max(item[1].z for item in ranked) - min(item[1].z for item in ranked)
        mid_z = (max(item[1].z for item in ranked) + min(item[1].z for item in ranked)) * 0.5
        remaining = set(range(len(ranked)))

        def take(index: int, name: str) -> None:
            remaining.discard(index)
            obj = ranked[index][0]
            obj.name = unique(name)
            obj.data.name = obj.name

        small = [i for i in remaining if max(ranked[i][2].x, ranked[i][2].y, ranked[i][2].z) < 0.35]
        if small:
            neck_i = max(small, key=lambda i: ranked[i][1].z)
            take(neck_i, "Body_Neck")
        if remaining:
            foot_i = min(remaining, key=lambda i: ranked[i][1].z)
            take(foot_i, "Body_Foot")
        mid = [
            i
            for i in remaining
            if abs(ranked[i][1].z - mid_z) < max(0.12, height_span * 0.2)
        ]
        if mid:
            chest_i = max(mid, key=lambda i: ranked[i][2].x)
            take(chest_i, "Body_Chest")
        side = [
            i
            for i in remaining
            if ranked[i][2].x < 0.25 and abs(ranked[i][1].x) > 0.15
        ]
        side.sort(key=lambda i: ranked[i][1].x)
        if len(side) >= 2:
            take(side[0], "Body_Hand_L")
            take(side[-1], "Body_Hand_R")
        elif side:
            take(side[0], "Body_Hand")
        for index in list(remaining):
            take(index, "Body_Part")
        return

    for obj in meshes:
        raw = strip_numeric_suffix(obj.name).lower()
        mapped = BODY_NAME_MAP.get(raw)
        if mapped is None:
            for token, name in BODY_NAME_MAP.items():
                if token in raw:
                    mapped = name
                    break
        if mapped is None:
            mapped = "Body_" + strip_numeric_suffix(obj.name).replace(" ", "_").title()
        obj.name = unique(mapped)
        obj.data.name = obj.name


def world_bbox(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    min_corner = Vector((1e9, 1e9, 1e9))
    max_corner = Vector((-1e9, -1e9, -1e9))
    for obj in meshes:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_corner.x = min(min_corner.x, world.x)
            min_corner.y = min(min_corner.y, world.y)
            min_corner.z = min(min_corner.z, world.z)
            max_corner.x = max(max_corner.x, world.x)
            max_corner.y = max(max_corner.y, world.y)
            max_corner.z = max(max_corner.z, world.z)
    return min_corner, max_corner


def purge_unused() -> None:
    used_images: set[bpy.types.Image] = set()
    used_materials: set[bpy.types.Material] = set()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for mat in obj.data.materials:
            if mat:
                used_materials.add(mat)
    for mat in used_materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if getattr(node, "image", None):
                used_images.add(node.image)
    for mat in list(bpy.data.materials):
        if mat not in used_materials:
            bpy.data.materials.remove(mat)
    for image in list(bpy.data.images):
        if image not in used_images:
            bpy.data.images.remove(image)
    for armature in list(bpy.data.armatures):
        bpy.data.armatures.remove(armature)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def filtered_gltf_kwargs(kwargs: dict) -> dict:
    rna_keys = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    return {
        key: value
        for key, value in kwargs.items()
        if key == "filepath" or key in rna_keys
    }


def export_glb(path: Path, objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    kwargs = {
        "filepath": str(path),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": False,
        "export_texcoords": True,
        "export_normals": True,
        "export_tangents": False,
        "export_materials": "EXPORT",
        "export_cameras": False,
        "export_lights": False,
        "export_extras": True,
        "check_existing": False,
        "export_morph": True,
        "export_morph_normal": False,
        "export_morph_tangent": False,
        "export_morph_animation": False,
        "export_skins": False,
        "export_animations": False,
        "export_image_format": "JPEG",
        "export_jpeg_quality": 80,
        "export_image_quality": 80,
        "export_unused_images": False,
        "export_unused_textures": False,
        "export_try_sparse_sk": True,
    }
    bpy.ops.export_scene.gltf(**filtered_gltf_kwargs(kwargs))


def inspect_glb(path: Path) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    icospheres = [obj.name for obj in bpy.data.objects if "Icosphere" in obj.name]
    armatures = [obj.name for obj in bpy.data.objects if obj.type == "ARMATURE"]
    min_corner, max_corner = world_bbox(meshes)
    height = max(max_corner.z - min_corner.z, max_corner.y - min_corner.y)
    print("INSPECT meshes", len(meshes))
    print("INSPECT objects", len(bpy.data.objects))
    print("INSPECT bbox", min_corner, max_corner, "H", height)
    print("INSPECT icospheres", icospheres)
    print("INSPECT armatures", armatures)
    print("INSPECT mesh names", sorted(obj.name for obj in meshes))
    for obj in meshes:
        if obj.name.startswith("Head"):
            keys = []
            if obj.data.shape_keys:
                keys = [block.name for block in obj.data.shape_keys.key_blocks]
            print("INSPECT", obj.name, "shapekeys", keys)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = "METRIC"

avatar = bpy.data.objects.new("Avatar", None)
bpy.context.collection.objects.link(avatar)

skin_image = make_skin_image("SkinAlbedo")
skin_mat = make_material("MAT_Skin", skin_image, True)
head_mat = make_material("MAT_SkinHead", skin_image, True)
eye_src = load_image(ROOT / "Outfits/Common/Eyes/Eyes_BasicEyes.png")
eye_mat = make_material("MAT_Iris", eye_src, True)

body_objs = process_import(BODY, avatar)
print("IMPORTED Body", [obj.name for obj in body_objs])
assign_mat(body_objs, skin_mat)
rename_body_meshes(body_objs)
print("RENAMED Body", [obj.name for obj in body_objs])

head_objs = process_import(HEAD, avatar)
print("IMPORTED Head", [obj.name for obj in head_objs])
assign_mat(head_objs, head_mat)
rename_meshes(head_objs, "Head")

eye_objs = process_import(EYES, avatar)
print("IMPORTED Eyes", [obj.name for obj in eye_objs])
assign_mat(eye_objs, eye_mat)
rename_meshes(eye_objs, "Eyes")

for hair_i, pair in enumerate(HAIRS):
    albedo_path = find_albedo(pair[0]) or find_albedo(pair[1])
    src = load_image(albedo_path) if albedo_path else None
    if src is not None:
        hair_img = recolor_id_image(
            src,
            ((0.92, 0.88, 0.82), (0.55, 0.42, 0.32), (0.25, 0.18, 0.12)),
            f"HairAlbedo_{hair_i}",
            size=512,
            keep_white=True,
        )
    else:
        hair_img = None
    hair_mat = make_material(f"MAT_Hair_{hair_i}", hair_img, True, alpha_hashed=True)
    for part_i, path in enumerate(pair):
        objs = process_import(path, avatar)
        assign_mat(objs, hair_mat)
        rename_meshes(objs, f"Hair_{hair_i}_{part_i}")

for outfit_i, parts in enumerate(OUTFITS):
    labels = ("top", "bottom", "feet")
    for label, path in zip(labels, parts):
        objs = process_import(path, avatar)
        albedo_path = find_albedo(path)
        src = load_image(albedo_path) if albedo_path else None
        palette = OUTFIT_PALETTES[outfit_i][label]
        if src is not None:
            cloth_img = recolor_id_image(
                src,
                palette,
                f"Cloth_{outfit_i}_{label}",
                size=512,
                keep_white=True,
            )
        else:
            cloth_img = None
        cloth_mat = make_material(
            f"MAT_Cloth_{outfit_i}_{label}",
            cloth_img,
            False,
        )
        assign_mat(objs, cloth_mat)
        rename_meshes(objs, f"Outfit_{outfit_i}_{label}")

for obj in list(bpy.data.objects):
    if obj.type == "MESH" and "Icosphere" in obj.name:
        bpy.data.objects.remove(obj, do_unlink=True)
    elif obj.type == "ARMATURE":
        bpy.data.objects.remove(obj, do_unlink=True)

purge_unused()
bpy.context.view_layer.update()

meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
min_corner, max_corner = world_bbox(meshes)
height = max(0.01, max_corner.z - min_corner.z)
print("PRE-NORMALIZE BBOX", min_corner, max_corner, "H", height)
print("A-POSE applied", A_POSE_APPLIED)
avatar.location.x -= (min_corner.x + max_corner.x) / 2
avatar.location.y -= (min_corner.y + max_corner.y) / 2
avatar.location.z -= min_corner.z
if height > 3.5:
    avatar.scale *= 0.01
    print("Applied 0.01 scale")

bpy.context.view_layer.update()

if bpy.ops.object.mode_set.poll():
    bpy.ops.object.mode_set(mode="OBJECT")
for obj in meshes:
    keep_world(obj, None)
if meshes:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    with bpy.context.temp_override(
        selected_objects=meshes,
        object=meshes[0],
        active_object=meshes[0],
    ):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

if avatar.name in bpy.data.objects:
    bpy.data.objects.remove(avatar, do_unlink=True)

bpy.context.view_layer.update()
meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
min_corner, max_corner = world_bbox(meshes)
post_height = max_corner.z - min_corner.z
print("POST-APPLY BBOX", min_corner, max_corner, "H", post_height)
print("POST bbox height", post_height)
print("MESH COUNT", len(meshes), "OBJECT COUNT", len(bpy.data.objects))
print("MESH names", sorted(obj.name for obj in meshes))
for obj in meshes:
    if obj.name.startswith("Head"):
        keys = []
        if obj.data.shape_keys:
            keys = [block.name for block in obj.data.shape_keys.key_blocks]
        print("Head shapekeys", obj.name, keys)

OUT.parent.mkdir(parents=True, exist_ok=True)
export_glb(OUT, meshes)
print("WROTE", OUT, "size", OUT.stat().st_size if OUT.exists() else 0)
print("A-POSE applied", A_POSE_APPLIED)
inspect_glb(OUT)
