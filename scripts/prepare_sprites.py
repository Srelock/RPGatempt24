"""Chroma-key green screens, crop animation sets, and save game-ready PNGs."""

from __future__ import annotations

import colorsys
import sys
from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\porte\.cursor\projects\c-Users-porte-Desktop-Arpad-Platformer\assets"
)
DST = Path(r"c:\Users\porte\Desktop\Arpad\Platformer\assets\sprites")

FOX_FRAMES = [
    "player-idle-1.png",
    "player-idle-2.png",
    "player-walk-1.png",
    "player-walk-2.png",
    "player-walk-3.png",
    "player-walk-4.png",
    "player-jump.png",
    "player-fall.png",
]
MALE_FRAMES = [
    "male-idle-1.png",
    "male-idle-2.png",
    "male-walk-1.png",
    "male-walk-2.png",
    "male-walk-3.png",
    "male-walk-4.png",
    "male-jump.png",
    "male-fall.png",
]
FEMALE_FRAMES = [
    "female-idle-1.png",
    "female-idle-2.png",
    "female-walk-1.png",
    "female-walk-2.png",
    "female-walk-3.png",
    "female-walk-4.png",
    "female-jump.png",
    "female-fall.png",
]
CHEST_FRAMES = ["chest-closed.png", "chest-open.png"]
ENEMY_FRAMES = [
    "enemy-walk-1.png",
    "enemy-walk-2.png",
    "enemy-walk-3.png",
    "enemy-walk-4.png",
]
COIN_FRAMES = ["coin-1.png", "coin-2.png", "coin-3.png", "coin-4.png"]


def is_green_screen(red: int, green: int, blue: int) -> bool:
    """Return True when a pixel is chroma-key green, not gold or cream."""
    if green < 70:
        return False
    dominates = green >= red + 28 and green >= blue + 18
    pale_mint = green > 170 and red < 230 and blue < 230 and green > red and green > blue
    return dominates or pale_mint


def chroma_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = list(rgba.getdata())
    keyed = []
    for red, green, blue, alpha in pixels:
        if is_green_screen(red, green, blue):
            keyed.append((0, 0, 0, 0))
            continue
        if green > red and green > blue:
            green = max(red, blue)
        keyed.append((red, green, blue, alpha))
    rgba.putdata(keyed)
    return rgba


def union_bbox(images: list[Image.Image]) -> tuple[int, int, int, int]:
    min_x, min_y = images[0].width, images[0].height
    max_x, max_y = 0, 0
    for image in images:
        box = image.getchannel("A").getbbox()
        if box is None:
            continue
        min_x = min(min_x, box[0])
        min_y = min(min_y, box[1])
        max_x = max(max_x, box[2])
        max_y = max(max_y, box[3])
    pad = 8
    min_x = max(0, min_x - pad)
    min_y = max(0, min_y - pad)
    max_x = min(images[0].width, max_x + pad)
    max_y = min(images[0].height, max_y + pad)
    return (min_x, min_y, max_x, max_y)


def save_set(names: list[str], max_side: int) -> None:
    images = [chroma_key(Image.open(SRC / name)) for name in names]
    box = union_bbox(images)
    cropped = [image.crop(box) for image in images]
    width, height = cropped[0].size
    scale = max_side / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    DST.mkdir(parents=True, exist_ok=True)
    for name, image in zip(names, cropped):
        resized = image.resize(size, Image.Resampling.LANCZOS)
        resized.save(DST / name, optimize=True)
        print(f"saved {name} {resized.size}")


def save_keyed(name: str, max_side: int) -> None:
    image = chroma_key(Image.open(SRC / name))
    box = image.getchannel("A").getbbox()
    if box is not None:
        image = image.crop(box)
    width, height = image.size
    scale = max_side / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    DST.mkdir(parents=True, exist_ok=True)
    resized = image.resize(size, Image.Resampling.LANCZOS)
    resized.save(DST / name, optimize=True)
    print(f"saved {name} {resized.size}")


ARMOR_PIECES = ["helmet", "shirt", "pants", "boots"]
ARMOR_PALETTES: dict[str, list[tuple[int, int, int]] | None] = {
    "leather": [
        (46, 28, 16),
        (82, 50, 28),
        (118, 74, 40),
        (154, 108, 62),
        (186, 146, 98),
    ],
    "copper": [
        (88, 36, 12),
        (156, 64, 22),
        (214, 114, 40),
        (240, 168, 72),
        (255, 220, 160),
    ],
    "iron": None,
    "platinum": [
        (48, 64, 78),
        (118, 148, 168),
        (186, 210, 224),
        (230, 242, 248),
        (255, 255, 255),
    ],
}


def lerp(start: float, end: float, amount: float) -> float:
    return start + (end - start) * amount


def sample_palette(
    stops: list[tuple[int, int, int]], amount: float
) -> tuple[int, int, int]:
    clamped = max(0.0, min(1.0, amount))
    scaled = clamped * (len(stops) - 1)
    index = int(scaled)
    frac = scaled - index
    if index >= len(stops) - 1:
        return stops[-1]
    left = stops[index]
    right = stops[index + 1]
    return (
        round(lerp(left[0], right[0], frac)),
        round(lerp(left[1], right[1], frac)),
        round(lerp(left[2], right[2], frac)),
    )


def square_icon(image: Image.Image, pad: int = 6) -> Image.Image:
    box = image.getchannel("A").getbbox()
    if box is None:
        return image
    cropped = image.crop(box)
    side = max(cropped.size) + pad * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset = ((side - cropped.width) // 2, (side - cropped.height) // 2)
    canvas.paste(cropped, offset, cropped)
    return canvas


def recolor_armor(
    image: Image.Image,
    palette: list[tuple[int, int, int]] | None,
    keep_straps: bool,
    matte: bool,
) -> Image.Image:
    if palette is None:
        return image.copy()
    pixels = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            pixels.append((0, 0, 0, 0))
            continue
        hue, sat, val = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if val < 0.16:
            pixels.append((red, green, blue, alpha))
            continue
        is_strap = hue < 0.12 and sat > 0.28 and val < 0.72
        if keep_straps and is_strap:
            pixels.append((red, green, blue, alpha))
            continue
        amount = min(0.82, val ** 1.35) if matte else val
        tone = sample_palette(palette, amount)
        pixels.append((tone[0], tone[1], tone[2], alpha))
    tinted = image.copy()
    tinted.putdata(pixels)
    return tinted


def save_armor_sets() -> None:
    sheet = chroma_key(Image.open(SRC / "armor-pieces.png"))
    width, height = sheet.size
    mid_x = width // 2
    mid_y = height // 2
    boxes = [
        (0, 0, mid_x, mid_y),
        (mid_x, 0, width, mid_y),
        (0, mid_y, mid_x, height),
        (mid_x, mid_y, width, height),
    ]
    pieces = [square_icon(sheet.crop(box)) for box in boxes]
    DST.mkdir(parents=True, exist_ok=True)
    for material, palette in ARMOR_PALETTES.items():
        keep_straps = material != "leather"
        matte = material == "leather"
        for piece_name, piece in zip(ARMOR_PIECES, pieces):
            tinted = recolor_armor(piece, palette, keep_straps, matte)
            size = (64, 64)
            resized = tinted.resize(size, Image.Resampling.LANCZOS)
            name = f"item-{material}-{piece_name}.png"
            resized.save(DST / name, optimize=True)
            print(f"saved {name} {resized.size}")


def save_plain(name: str, max_side: int) -> None:
    image = Image.open(SRC / name).convert("RGBA")
    width, height = image.size
    scale = max_side / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    DST.mkdir(parents=True, exist_ok=True)
    resized.save(DST / name, optimize=True)
    print(f"saved {name} {resized.size}")


def main() -> None:
    save_set(FOX_FRAMES, 256)
    save_set(MALE_FRAMES, 256)
    save_set(FEMALE_FRAMES, 256)
    save_set(ENEMY_FRAMES, 192)
    save_set(COIN_FRAMES, 128)
    save_set(CHEST_FRAMES, 160)
    save_keyed("building-general.png", 280)
    save_keyed("building-forge.png", 280)
    save_plain("tile-ground.png", 128)
    save_plain("tile-town.png", 128)
    save_plain("background.png", 1600)
    save_plain("town-background.png", 1600)
    for name in [
        "item-apple.png",
        "item-potion.png",
        "item-rope.png",
        "item-sword.png",
        "item-shield.png",
        "item-pickaxe.png",
        "ui-backpack.png",
        "ui-lock.png",
    ]:
        save_keyed(name, 64)
    save_armor_sets()


if __name__ == "__main__":
    if "armor" in sys.argv:
        save_armor_sets()
    else:
        main()
