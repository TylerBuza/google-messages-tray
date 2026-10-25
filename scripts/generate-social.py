"""Create a share image using the original logo and fictional-message demo."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
image = Image.new("RGB", (1280, 640), "#151b28")
draw = ImageDraw.Draw(image)

def font(size, bold=False):
    return ImageFont.truetype("C:/Windows/Fonts/" + ("segoeuib.ttf" if bold else "segoeui.ttf"), size)

logo = Image.open(root / "assets/icon.png").convert("RGBA").resize((84, 84), Image.Resampling.LANCZOS)
image.paste(logo, (64, 55), logo)
draw.text((170, 66), "MESSAGES TRAY", font=font(27, True), fill="#eef4ff")
draw.text((170, 107), "Google Messages companion for Windows", font=font(20), fill="#9aaac8")
draw.text((66, 205), "Your texts in the tray.", font=font(53, True), fill="#eef4ff")
draw.text((66, 282), "Your codes,", font=font(53, True), fill="#a9c8ff")
draw.text((66, 355), "one click away.", font=font(53, True), fill="#a9c8ff")
popup = Image.open(root / "docs/images/notification-demo.png").convert("RGB")
popup.thumbnail((500, 300), Image.Resampling.LANCZOS)
image.paste(popup, (716, 235))
draw.text((68, 527), "Hide to tray  /  Desktop popups  /  Copy OTP codes", font=font(23), fill="#cad6ee")
draw.text((68, 577), "OPEN SOURCE  ·  MIT LICENSED  ·  UNOFFICIAL", font=font(17, True), fill="#9aaac8")
image.save(root / "docs/images/social-preview.png")
print("Generated docs/images/social-preview.png")
