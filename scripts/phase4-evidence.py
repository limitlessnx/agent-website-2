"""Encode selected synthetic screenshots losslessly for review; retain PNG provenance."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[1] / "docs" / "phase4"
output = root / "screenshots"
output.mkdir(exist_ok=True)
selected = [("after", screen, width) for screen in ("platform", "organizations", "provisioning") for width in (360, 430, 768, 1024, 1440, 1920)]
selected += [(state, screen, width) for state in ("before", "after") for screen in ("organizations", "agent-operations") for width in (360, 1440)]
manifest = []
for state, screen, width in dict.fromkeys(selected):
    source = root / state / f"{screen}-{width}.png"
    target = output / f"{state}-{screen}-{width}.webp"
    original = Image.open(source).convert("RGBA")
    original.save(target, format="WEBP", lossless=True, method=6, exact=True)
    decoded = Image.open(target).convert("RGBA")
    assert original.size == decoded.size and original.tobytes() == decoded.tobytes(), target
    manifest.append({"file": target.name, "source": str(source.relative_to(root)), "width": original.width, "height": original.height, "png_sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "webp_sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "pixel_identical": True})
(output / "manifest.json").write_text(json.dumps({"data": "Local synthetic fixtures only", "approval": "Implementation review evidence; not user-approved visual baselines", "screenshots": manifest}, indent=2) + "\n")
print(f"Exported {len(manifest)} pixel-identical screenshots.")
