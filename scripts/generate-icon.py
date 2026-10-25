"""Generate original Messages Tray artwork. Optional dev dependency: Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
assets = root / "assets"
assets.mkdir(exist_ok=True)
scale = 4
image = Image.new("RGBA", (256 * scale, 256 * scale))
draw = ImageDraw.Draw(image)
def box(coords):
    return tuple(int(value * scale) for value in coords)
draw.rounded_rectangle(box((10, 10, 246, 246)), radius=58 * scale, fill="#151b28")
draw.rounded_rectangle(box((44, 51, 213, 181)), radius=34 * scale, fill="#a9c8ff")
draw.polygon([box((67, 166)), box((67, 210)), box((117, 174))], fill="#a9c8ff")
draw.rounded_rectangle(box((76, 91, 181, 105)), radius=7 * scale, fill="#151b28")
draw.rounded_rectangle(box((76, 127, 153, 141)), radius=7 * scale, fill="#151b28")
image = image.resize((256, 256), Image.Resampling.LANCZOS)
image.save(assets / "icon.png")
image.save(assets / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("Generated assets/icon.png and assets/icon.ico")
