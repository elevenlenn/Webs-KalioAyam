import os
import re
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(root, "index.html"), encoding="utf-8").read()
img_dir = os.path.join(root, "public", "assets", "img")

REQUIRED = [
    "hero-topdown.webp",
    "hero-angle.webp",
    "hero-closeup.webp",
    "bahan-santan.webp",
    "bahan-ayam.webp",
    "bahan-lengkuas.webp",
    "bahan-jahe.webp",
    "bahan-kunyit.webp",
    "bahan-serai.webp",
    "bahan-daun-salam.webp",
    "bg-kayu.webp",
    "bg-daun-pisang.webp",
]

missing_files = [f for f in REQUIRED if not os.path.exists(os.path.join(img_dir, f))]
CUTOUTS = [f for f in REQUIRED if not f.startswith("bg-")]
missing_files += [f.replace(".webp", "-480.webp") for f in CUTOUTS
                  if not os.path.exists(os.path.join(img_dir, f.replace(".webp", "-480.webp")))]
referenced = set(re.findall(r"/assets/img/([a-z0-9-]+\.webp)", html))
unreferenced = sorted(set(os.listdir(img_dir)) - referenced)

img_tags = re.findall(r"<img\b[^>]*>", html, re.S)
missing_src = []
mismatched_dims = []
missing_alt = []

for tag in img_tags:
    m_src = re.search(r'src="/assets/img/([^"]+)"', tag)
    if not m_src:
        continue
    fname = m_src.group(1)
    p = os.path.join(img_dir, fname)
    if not os.path.exists(p):
        missing_src.append(fname)
        continue
    real_w, real_h = Image.open(p).size
    mw = re.search(r'width="(\d+)"', tag)
    mh = re.search(r'height="(\d+)"', tag)
    if not mw or not mh or int(mw.group(1)) != real_w or int(mh.group(1)) != real_h:
        mismatched_dims.append((fname, (mw.group(1) if mw else None, mh.group(1) if mh else None), (real_w, real_h)))
    if 'alt="' not in tag:
        missing_alt.append(fname)

required_headings = [
    "Kalio Ayam",
    "Cita rasa gurih khas Minangkabau",
    "Apa itu Kalio Ayam",
    "Bahan-bahan",
    "Bahan-bahan di balik kuah kalio yang kental dan harum.",
    "Peran Setiap Bahan",
    "Proses Memasak",
    "Tonton langkah demi langkah cara memasak kalio ayam.",
    "Tonton di YouTube",
]
forbidden = ["Cara Penyajian", "pendamping-", "kombucha", "Kombucha"]
present_forbidden = [f for f in forbidden if f in html]
missing_copy = [h for h in required_headings if h not in html]

print("Required image files missing:", missing_files)
print("Total <img> checked:", len(img_tags))
print("Missing image refs:", missing_src)
print("Dimension mismatches:", mismatched_dims)
print("Missing alt attributes:", missing_alt)
print("Missing required section titles/copy:", missing_copy)
print("Forbidden leftovers present:", present_forbidden)
print("Unreferenced files in public/assets/img:", unreferenced)
assert not missing_files and not missing_src and not mismatched_dims and not missing_alt and not missing_copy and not present_forbidden and not unreferenced
print("ALL STATIC VERIFICATION CHECKS PASSED!")
