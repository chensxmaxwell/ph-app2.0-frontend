#!/usr/bin/env python3
"""Rewrite BoZo GLB images: peach skin + garment palettes from Unity ID maps.

Blender's Image.copy()+pack() kept the original packed ID files, so the
exported GLB still had heatmap clothes and a black SkinAlbedo JPEG.
"""
from __future__ import annotations

import json
import random
import struct
from io import BytesIO
from pathlib import Path

from PIL import Image

GLB = Path(__file__).resolve().parents[1] / "assets" / "avatar-engine" / "bozo-male.glb"

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

# glTF image index → (outfit, part)
CLOTH_IMAGES = {
    6: (0, "top"),
    7: (0, "bottom"),
    8: (0, "feet"),
    9: (1, "top"),
    10: (1, "bottom"),
    11: (1, "feet"),
    12: (2, "top"),
    13: (2, "bottom"),
    14: (2, "feet"),
    15: (3, "top"),
    16: (3, "bottom"),
    17: (3, "feet"),
}

JSON_TYPE = 0x4E4F534A
BIN_TYPE = 0x004E4942


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("not a GLB")
    offset = 12
    json_len, json_type = struct.unpack_from("<II", data, offset)
    if json_type != JSON_TYPE:
        raise ValueError("first chunk is not JSON")
    js = json.loads(data[offset + 8 : offset + 8 + json_len])
    offset = 12 + 8 + json_len
    bin_len, bin_type = struct.unpack_from("<II", data, offset)
    if bin_type != BIN_TYPE:
        raise ValueError("second chunk is not BIN")
    blob = data[offset + 8 : offset + 8 + bin_len]
    return js, blob


def write_glb(path: Path, js: dict, blob: bytes) -> None:
    json_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - (len(json_bytes) % 4)) % 4)
    blob = blob + (b"\x00" * ((4 - (len(blob) % 4)) % 4))
    length = 12 + 8 + len(json_bytes) + 8 + len(blob)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, length)
    out += struct.pack("<II", len(json_bytes), JSON_TYPE)
    out += json_bytes
    out += struct.pack("<II", len(blob), BIN_TYPE)
    out += blob
    path.write_bytes(out)


def extract_image(js: dict, blob: bytes, image_index: int) -> bytes:
    image = js["images"][image_index]
    view = js["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return blob[start : start + view["byteLength"]]


def encode_png(image: Image.Image) -> bytes:
    buf = BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def make_skin_png(size: int = 512) -> bytes:
    rng = random.Random(7)
    base = (245, 224, 204)
    pixels = []
    for y in range(size):
        for x in range(size):
            nx = x / size - 0.5
            ny = y / size - 0.5
            ao = 1.0 - 0.07 * min(1.0, (nx * nx + ny * ny) * 3.2)
            grain = 1.0 + (rng.random() - 0.5) * 0.035
            shade = ao * grain
            pixels.append(
                (
                    min(255, int(base[0] * shade)),
                    min(255, int(base[1] * shade)),
                    min(255, int(base[2] * shade)),
                    255,
                )
            )
    img = Image.new("RGBA", (size, size))
    img.putdata(pixels)
    return encode_png(img.convert("RGB"))


def recolor_id(raw: bytes, palette: tuple) -> bytes:
    img = Image.open(BytesIO(raw)).convert("RGBA")
    if max(img.size) > 512:
        img = img.resize((512, 512), Image.Resampling.NEAREST)
    color_r, color_g, color_b = palette
    src = img.tobytes()
    out = bytearray(len(src))
    for i in range(0, len(src), 4):
        red_u = src[i]
        green_u = src[i + 1]
        blue_u = src[i + 2]
        alpha = src[i + 3]
        red = red_u / 255.0
        green = green_u / 255.0
        blue = blue_u / 255.0
        maximum = red if red > green else green
        if blue > maximum:
            maximum = blue
        minimum = red if red < green else green
        if blue < minimum:
            minimum = blue
        if maximum < 0.08:
            out[i] = 0
            out[i + 1] = 0
            out[i + 2] = 0
            out[i + 3] = alpha
            continue
        if minimum > 0.88 and (maximum - minimum) < 0.10:
            out[i : i + 4] = src[i : i + 4]
            continue
        out[i] = min(255, int((red * color_r[0] + green * color_g[0] + blue * color_b[0]) * 255))
        out[i + 1] = min(255, int((red * color_r[1] + green * color_g[1] + blue * color_b[1]) * 255))
        out[i + 2] = min(255, int((red * color_r[2] + green * color_g[2] + blue * color_b[2]) * 255))
        out[i + 3] = alpha
    img = Image.frombytes("RGBA", img.size, bytes(out))
    return encode_png(img.convert("RGB"))


def rebuild(js: dict, blob: bytes, replacements: dict[int, tuple[bytes, str]]) -> tuple[dict, bytes]:
    views = js["bufferViews"]
    image_view_ids = {img["bufferView"]: i for i, img in enumerate(js["images"])}
    new_blob = bytearray()
    new_views = []
    for view_i, view in enumerate(views):
        start = view.get("byteOffset", 0)
        length = view["byteLength"]
        img_i = image_view_ids.get(view_i)
        if img_i in replacements:
            payload, mime = replacements[img_i]
            js["images"][img_i]["mimeType"] = mime
        else:
            payload = blob[start : start + length]
        pad = (4 - (len(new_blob) % 4)) % 4
        new_blob.extend(b"\x00" * pad)
        offset = len(new_blob)
        new_blob.extend(payload)
        next_view = dict(view)
        next_view["byteOffset"] = offset
        next_view["byteLength"] = len(payload)
        new_views.append(next_view)
    js["bufferViews"] = new_views
    js["buffers"][0]["byteLength"] = len(new_blob)
    return js, bytes(new_blob)


def main() -> None:
    js, blob = read_glb(GLB)
    replacements: dict[int, tuple[bytes, str]] = {
        0: (make_skin_png(), "image/png"),
    }
    for image_index, (outfit, part) in CLOTH_IMAGES.items():
        raw = extract_image(js, blob, image_index)
        palette = OUTFIT_PALETTES[outfit][part]
        replacements[image_index] = (recolor_id(raw, palette), "image/png")
        print("recolored", js["images"][image_index].get("name"), outfit, part)
    js, blob = rebuild(js, blob, replacements)
    write_glb(GLB, js, blob)
    print("wrote", GLB, "bytes", GLB.stat().st_size)


if __name__ == "__main__":
    main()
