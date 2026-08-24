#!/usr/bin/env python3
"""Add a peach face albedo + normal map to MAT_SkinHead only."""
from __future__ import annotations

import importlib.util
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path("/Users/maxwell/Downloads/BoZo_StylizedModularCharacters")
HEAD_D = ROOT / "Outfits/Common/BSMC_Head/Head_V2/Head_BasicStylizedHead_D.png"
HEAD_N = ROOT / "Outfits/Common/BSMC_Head/Head_V2/Head_BasicStylizedHead_N.png"

SPEC = importlib.util.spec_from_file_location(
    "bozo_tex",
    Path(__file__).with_name("patch-bozo-textures.py"),
)
tex = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tex)

PEACH = (245, 210, 186)


def face_albedo_png() -> bytes:
    src = Image.open(HEAD_D).convert("RGB").resize((512, 512), Image.Resampling.BILINEAR)
    pixels = src.tobytes()
    out = bytearray(len(pixels))
    for i in range(0, len(pixels), 3):
        red, green, blue = pixels[i], pixels[i + 1], pixels[i + 2]
        if red + green + blue < 18:
            out[i] = PEACH[0] // 4
            out[i + 1] = PEACH[1] // 4
            out[i + 2] = PEACH[2] // 4
            continue
        luma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255.0
        shade = 0.74 + 0.36 * luma
        blush = max(0.0, (red - green) / 255.0) * 0.35
        out[i] = min(255, int(PEACH[0] * shade + blush * 18))
        out[i + 1] = min(255, int(PEACH[1] * shade - blush * 6))
        out[i + 2] = min(255, int(PEACH[2] * shade - blush * 4))
    img = Image.frombytes("RGB", (512, 512), bytes(out))
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def face_normal_png() -> bytes:
    src = Image.open(HEAD_N).convert("RGB").resize((512, 512), Image.Resampling.BILINEAR)
    buf = BytesIO()
    src.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def append_png(js: dict, blob: bytes, payload: bytes, name: str) -> tuple[dict, bytes, int]:
    pad = (4 - (len(blob) % 4)) % 4
    blob = blob + (b"\x00" * pad)
    offset = len(blob)
    blob = blob + payload
    js["bufferViews"].append(
        {
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(payload),
        }
    )
    js["images"].append(
        {
            "bufferView": len(js["bufferViews"]) - 1,
            "mimeType": "image/png",
            "name": name,
        }
    )
    js["textures"].append({"sampler": 0, "source": len(js["images"]) - 1})
    js["buffers"][0]["byteLength"] = len(blob)
    return js, blob, len(js["textures"]) - 1


def main() -> None:
    js, blob = tex.read_glb(tex.GLB)
    albedo = face_albedo_png()
    normal = face_normal_png()
    names = {image.get("name"): index for index, image in enumerate(js["images"])}
    if "FaceAlbedo" in names and "FaceNormal" in names:
        js, blob = tex.rebuild(
            js,
            blob,
            {
                names["FaceAlbedo"]: (albedo, "image/png"),
                names["FaceNormal"]: (normal, "image/png"),
            },
        )
        print("replaced FaceAlbedo/FaceNormal")
    else:
        js, blob, albedo_tex = append_png(js, blob, albedo, "FaceAlbedo")
        js, blob, normal_tex = append_png(js, blob, normal, "FaceNormal")
        for mat in js["materials"]:
            if mat.get("name") != "MAT_SkinHead":
                continue
            pbr = mat.setdefault("pbrMetallicRoughness", {})
            pbr["baseColorTexture"] = {"index": albedo_tex}
            mat["normalTexture"] = {"index": normal_tex, "scale": 0.9}
            print("wired", mat["name"], "albedo", albedo_tex, "normal", normal_tex)
    tex.write_glb(tex.GLB, js, blob)
    print("wrote", tex.GLB, "bytes", tex.GLB.stat().st_size)


if __name__ == "__main__":
    main()
