"""
Rebuild the site images from the originals in /assets-src/.

  python scripts/process_assets.py

Requires: opencv-python, numpy, pillow.
Cutouts (items 1-10) -> transparent WebP <= 1600px plus a 480px srcset variant;
backgrounds -> WebP <= 2200px wide.
A dark-background audit sheet is written to the system temp dir for halo inspection.
"""
import os
import tempfile
import cv2
import numpy as np
from PIL import Image

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(WORKSPACE, "assets-src")
OUT_DIR = os.path.join(WORKSPACE, "public", "assets", "img")
SCRATCH_DIR = os.path.join(tempfile.gettempdir(), "kalio-asset-audit")

os.makedirs(SRC_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

# All 10 transparent cutout targets (spec items 1..10)
CUTOUT_SPECS = [
    ("hero-topdown", "dish"),
    ("hero-angle", "dish"),
    ("hero-closeup", "dish"),
    ("bahan-santan", "coconut"),
    ("bahan-ayam", "chicken"),
    ("bahan-lengkuas", "clean"),
    ("bahan-jahe", "clean"),
    ("bahan-kunyit", "turmeric"),
    ("bahan-serai", "serai"),
    ("bahan-daun-salam", "clean"),
]

# Full-bleed background textures (items 11..12, max 2200px wide)
BACKGROUND_SPECS = [
    "bg-kayu",
    "bg-daun-pisang",
]


def border_connected_bg(candidate_mask: np.ndarray) -> np.ndarray:
    """Keep only connected components of candidate_mask that touch the image border."""
    h, w = candidate_mask.shape
    num_labels, labels = cv2.connectedComponents(candidate_mask.astype(np.uint8), connectivity=4)
    border_labels = set()
    border_labels.update(np.unique(labels[0, :]).tolist())
    border_labels.update(np.unique(labels[h - 1, :]).tolist())
    border_labels.update(np.unique(labels[:, 0]).tolist())
    border_labels.update(np.unique(labels[:, w - 1]).tolist())
    border_labels.discard(0)
    if not border_labels:
        return np.zeros_like(candidate_mask, dtype=bool)
    return np.isin(labels, list(border_labels))


def fill_small_holes(fg_mask: np.ndarray, max_hole_area: int = 800) -> np.ndarray:
    """Fill tiny internal holes in the foreground mask."""
    inv = (~fg_mask).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    h, w = fg_mask.shape
    border_labels = set()
    border_labels.update(np.unique(labels[0, :]).tolist())
    border_labels.update(np.unique(labels[h - 1, :]).tolist())
    border_labels.update(np.unique(labels[:, 0]).tolist())
    border_labels.update(np.unique(labels[:, w - 1]).tolist())
    out = fg_mask.copy()
    for lbl in range(1, num_labels):
        if lbl in border_labels:
            continue
        if stats[lbl, cv2.CC_STAT_AREA] <= max_hole_area:
            out[labels == lbl] = True
    return out


def remove_white_bg_edge_aware(bgr: np.ndarray, mode: str) -> np.ndarray:
    """
    Edge-aware pure-white & floor-shadow removal with GrabCut refinement
    and color decontamination (zero white halo on dark backgrounds).
    """
    h, w = bgr.shape[:2]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[:, :, 0] * (100.0 / 255.0)
    a = lab[:, :, 1] - 128.0
    b = lab[:, :, 2] - 128.0
    chroma = np.sqrt(a * a + b * b)

    protected_interior = np.zeros((h, w), dtype=bool)

    if mode == "dish":
        # Dark ceramic/clay bowls & glazed chicken on pure white
        bg_cand = (L > 87.0) & (chroma < 7.5)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 79.0) & (chroma < 6.5))
        fg_seed = (L < 74.0) | (chroma > 11.0)
    elif mode == "chicken":
        # Pale golden-pink chicken skin & meat on pure #FFFFFF white
        bg_cand = (L > 94.5) & (chroma < 5.5)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 90.0) & (chroma < 7.0))
        fg_seed = (chroma > 10.5) | (L < 84.0)
        # Seal enclosed pale highlights inside the chicken pieces
        meat_outline = (chroma > 9.0) | (L < 88.0)
        meat_closed = cv2.morphologyEx(
            meat_outline.astype(np.uint8),
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)),
        ) > 0
        protected_interior = ~border_connected_bg(~meat_closed)
    elif mode == "clean":
        # Clean zero-shadow cutouts (lengkuas, jahe, daun salam)
        bg_cand = (L > 92.5) & (chroma < 6.5)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 86.0) & (chroma < 6.0))
        fg_seed = (L < 80.0) | (chroma > 10.5)
    elif mode == "turmeric":
        # Turmeric roots & green leaves: strip any neutral gray leaf shadow (chroma < 12)
        bg_cand = (L > 44.0) & (chroma < 11.5)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 38.0) & (chroma < 13.0))
        fg_seed = (chroma > 16.0) | (L < 35.0)
    elif mode == "serai":
        # Lemongrass pale ivory base + green stalk/knot + kaffir lime leaves; strip neutral gray shadow
        bg_cand = ((L > 92.5) & (chroma < 4.5)) | ((L > 62.0) & (chroma < 5.8) & (b < 3.6))
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 60.0) & (chroma < 6.2) & (b < 4.2))
        fg_seed = (chroma > 8.0) | (L < 58.0) | ((b > 4.8) & (L < 95.0))
    elif mode == "coconut":
        # Halved brown coconut + white flesh + textured white shreds; strip ALL neutral gray floor shadows!
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        grad = np.sqrt(gx * gx + gy * gy)
        grad_density = cv2.GaussianBlur((grad > 17.0).astype(np.float32), (11, 11), 0)

        # True brown coconut shell has warm positive b and chroma (never neutral gray floor shadow!)
        shell = (chroma > 12.5) & (b > 6.5)
        shell_closed = cv2.morphologyEx(
            shell.astype(np.uint8),
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)),
        ) > 0
        inside_coconut = ~border_connected_bg(~shell_closed)
        protected_interior = inside_coconut

        # Textured white coconut shreds in lower-right quadrant
        yy, xx = np.mgrid[0:h, 0:w]
        shred_zone = (yy > int(h * 0.58)) & (xx > int(w * 0.48))
        shred_core = (grad_density > 0.24) & shred_zone & (L > 72.0) & (L < 97.5)
        shred_mask = cv2.morphologyEx(
            shred_core.astype(np.uint8),
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
        ) > 0
        n_s, l_s, st_s, _ = cv2.connectedComponentsWithStats(shred_mask.astype(np.uint8), connectivity=8)
        shred_clean = np.zeros_like(shred_mask, dtype=bool)
        if n_s > 1:
            largest_s = 1 + int(np.argmax(st_s[1:, cv2.CC_STAT_AREA]))
            shred_clean = l_s == largest_s

        not_subject = (~inside_coconut) & (~shred_clean)
        smooth_neutral_shadow = (chroma < 9.5) & (L > 28.0) & (grad_density < 0.23)
        bg_cand = not_subject & ((L > 95.0) | smooth_neutral_shadow)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg(not_subject & (chroma < 11.0) & (L > 25.0))
        fg_seed = inside_coconut | (shred_clean & (grad_density > 0.28))
    else:
        bg_cand = (L > 92.0) & (chroma < 6.5)
        sure_bg = border_connected_bg(bg_cand)
        prob_bg = border_connected_bg((L > 85.0) & (chroma < 7.0))
        fg_seed = (L < 80.0) | (chroma > 11.0)

    gc_mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    gc_mask[prob_bg] = cv2.GC_PR_BGD
    gc_mask[sure_bg] = cv2.GC_BGD

    k_edge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    sure_bg_eroded = cv2.erode(sure_bg.astype(np.uint8), k_edge, iterations=1) > 0
    gc_mask[sure_bg & (~sure_bg_eroded)] = cv2.GC_PR_BGD

    fg_seed_eroded = cv2.erode(
        fg_seed.astype(np.uint8),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
        iterations=1,
    ) > 0
    gc_mask[fg_seed_eroded & (~sure_bg)] = cv2.GC_FGD

    if np.any(protected_interior):
        inner_eroded = cv2.erode(
            protected_interior.astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
            iterations=1,
        ) > 0
        gc_mask[inner_eroded] = cv2.GC_FGD

    scale = 0.5 if max(h, w) > 900 else 1.0
    if scale < 1.0:
        sh, sw = int(h * scale), int(w * scale)
        bgr_s = cv2.resize(bgr, (sw, sh), interpolation=cv2.INTER_AREA)
        gc_s = cv2.resize(gc_mask, (sw, sh), interpolation=cv2.INTER_NEAREST)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(bgr_s, gc_s, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)
        fg_s = ((gc_s == cv2.GC_FGD) | (gc_s == cv2.GC_PR_FGD)).astype(np.uint8)
        fg_mask = cv2.resize(fg_s, (w, h), interpolation=cv2.INTER_LINEAR) > 0.5
    else:
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        cv2.grabCut(bgr, gc_mask, None, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_MASK)
        fg_mask = (gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD)

    if np.any(protected_interior):
        fg_mask = fg_mask | inner_eroded

    # Post-pass for coconut: guarantee zero neutral gray shadow outside shell & shreds
    if mode == "coconut":
        fg_mask = fg_mask & (~(sure_bg))

    num_l, labels, stats, _ = cv2.connectedComponentsWithStats(fg_mask.astype(np.uint8), connectivity=8)
    clean_fg = np.zeros_like(fg_mask, dtype=bool)
    min_area = 250 if mode != "coconut" else 80
    for lbl in range(1, num_l):
        if stats[lbl, cv2.CC_STAT_AREA] >= min_area:
            clean_fg[labels == lbl] = True

    clean_fg = fill_small_holes(clean_fg, max_hole_area=900)

    # Erode 1px + soft anti-aliased edge + white spill decontamination
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded_fg = cv2.erode(clean_fg.astype(np.uint8), k3, iterations=1)
    alpha_f = cv2.GaussianBlur(eroded_fg.astype(np.float32), (3, 3), 0.85)
    alpha_f = np.clip((alpha_f - 0.14) / 0.78, 0.0, 1.0)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    edge_zone = (alpha_f > 0.0) & (alpha_f < 0.98)
    if np.any(edge_zone):
        interior = alpha_f >= 0.98
        int_f = interior.astype(np.float32)
        weight = cv2.GaussianBlur(int_f, (9, 9), 2.2)
        decontam = np.empty_like(rgb)
        for c in range(3):
            num = cv2.GaussianBlur(rgb[:, :, c] * int_f, (9, 9), 2.2)
            nearest_fg = np.where(weight > 1e-4, num / np.maximum(weight, 1e-4), rgb[:, :, c])
            unpremul = np.clip((rgb[:, :, c] - (1.0 - alpha_f) * 255.0) / np.maximum(alpha_f, 0.2), 0.0, 255.0)
            mix = np.clip(alpha_f, 0.0, 1.0)
            decontam[:, :, c] = np.where(edge_zone, mix * unpremul + (1.0 - mix) * nearest_fg, rgb[:, :, c])
        rgb = np.clip(decontam, 0, 255)

    rgba = np.dstack([rgb.astype(np.uint8), (alpha_f * 255.0).astype(np.uint8)])
    return rgba


def trim_and_save_webp(rgba: np.ndarray, out_path: str, max_dim: int = 1600, quality: int = 85):
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 8)
    if len(xs) == 0 or len(ys) == 0:
        raise RuntimeError(f"Empty cutout for {out_path}")
    pad = 8
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(rgba.shape[1], int(xs.max()) + pad + 1)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(rgba.shape[0], int(ys.max()) + pad + 1)
    cropped = rgba[y0:y1, x0:x1]

    img = Image.fromarray(cropped, mode="RGBA")
    w, h = img.size
    if max(w, h) > max_dim:
        ratio = max_dim / float(max(w, h))
        img = img.resize((int(round(w * ratio)), int(round(h * ratio))), Image.Resampling.LANCZOS)

    img.save(out_path, format="WEBP", quality=quality, method=6)
    return img


SMALL_VARIANT_WIDTH = 480


def save_small_variant(img: Image.Image, slug: str) -> str:
    """Write <slug>-480.webp for srcset (mobile and small display slots)."""
    w, h = img.size
    nh = int(round(h * SMALL_VARIANT_WIDTH / float(w)))
    name = f"{slug}-{SMALL_VARIANT_WIDTH}.webp"
    img.resize((SMALL_VARIANT_WIDTH, nh), Image.Resampling.LANCZOS).save(
        os.path.join(OUT_DIR, name), format="WEBP", quality=82, method=6
    )
    return name


def main():
    # 1. Process all transparent cutouts
    processed_imgs = []
    valid_outputs = set()

    for slug, mode in CUTOUT_SPECS:
        src_path = os.path.join(SRC_DIR, f"{slug}.jpg")
        out_path = os.path.join(OUT_DIR, f"{slug}.webp")
        valid_outputs.add(f"{slug}.webp")

        bgr = cv2.imread(src_path, cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(f"Missing source image: {src_path}")
        rgba = remove_white_bg_edge_aware(bgr, mode)
        img = trim_and_save_webp(rgba, out_path, max_dim=1600, quality=85)
        valid_outputs.add(save_small_variant(img, slug))
        kb = os.path.getsize(out_path) / 1024.0
        print(f"Cutout OK: {slug}.webp -> {img.size[0]}x{img.size[1]} ({kb:.1f} KB)")
        processed_imgs.append((slug, img))

    # 2. Process 2 background textures (max 2200px wide, quality 85)
    for slug in BACKGROUND_SPECS:
        src_path = os.path.join(SRC_DIR, f"{slug}.jpg")
        out_path = os.path.join(OUT_DIR, f"{slug}.webp")
        valid_outputs.add(f"{slug}.webp")

        img = Image.open(src_path).convert("RGB")
        w, h = img.size
        if w > 2200:
            ratio = 2200.0 / w
            img = img.resize((2200, int(round(h * ratio))), Image.Resampling.LANCZOS)
        img.save(out_path, format="WEBP", quality=85, method=6)
        kb = os.path.getsize(out_path) / 1024.0
        print(f"Background OK: {slug}.webp -> {img.size[0]}x{img.size[1]} ({kb:.1f} KB)")

    # 3. Clean up obsolete non-spec files in /public/assets/img/
    for fn in os.listdir(OUT_DIR):
        if fn not in valid_outputs:
            os.remove(os.path.join(OUT_DIR, fn))
            print(f"Removed legacy asset: {fn}")

    # 4. Dark-background (#14100D) audit sheet to inspect cutouts for white halos / shadows
    cols, rows = 5, 2
    cell = 340
    sheet = Image.new("RGB", (cell * cols, cell * rows), (20, 16, 13))
    for idx, (slug, img) in enumerate(processed_imgs):
        r, c = divmod(idx, cols)
        thumb = img.copy()
        thumb.thumbnail((cell - 32, cell - 32), Image.Resampling.LANCZOS)
        ox = c * cell + (cell - thumb.size[0]) // 2
        oy = r * cell + (cell - thumb.size[1]) // 2
        sheet.paste(thumb, (ox, oy), thumb)
    audit_path = os.path.join(SCRATCH_DIR, "cutout_audit.png")
    sheet.save(audit_path)
    print(f"Audit sheet saved: {audit_path}")


if __name__ == "__main__":
    main()
