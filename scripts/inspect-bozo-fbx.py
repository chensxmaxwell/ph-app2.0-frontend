import bpy
from pathlib import Path

ROOT = Path("/Users/maxwell/Downloads/BoZo_StylizedModularCharacters")
FILES = [
    ROOT / "Outfits/Common/Body/Body_BasicBodyV2/Body_BasicBodyV2.fbx",
    ROOT / "Outfits/Common/BSMC_Head/Head_V2/Head_V2.fbx",
    ROOT / "Outfits/Common/Eyes/Eyes_BasicEyes.fbx",
]

bpy.ops.wm.read_factory_settings(use_empty=True)
for path in FILES:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=str(path), ignore_leaf_bones=True)
    new = [o for o in bpy.data.objects if o not in before]
    print("FILE", path.name)
    for obj in new:
        keys = []
        if obj.type == "MESH" and obj.data.shape_keys:
            keys = [k.name for k in obj.data.shape_keys.key_blocks]
        print(" ", obj.type, obj.name, "verts", len(obj.data.vertices) if obj.type == "MESH" else "-", "keys", keys[:20], "dim", [round(x, 3) for x in obj.dimensions] if obj.type == "MESH" else None)
    print()
