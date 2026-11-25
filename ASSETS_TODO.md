# Assets Status

All **12 image assets** in `/public/assets/img/` are AI-generated studio photographs with one shared warm top-left lighting setup. No placeholders remain. Originals are kept in `/assets-src/`. To rebuild the WebP files, run `python scripts/process_assets.py`, then check them with `python scripts/verify_site.py`.

## Hero dish cutouts (WebP with alpha, <= 1600px, quality 85)
1. `hero-topdown.webp`: top-down Kalio Ayam in a dark handmade ceramic bowl, glossy golden-brown coconut-milk gravy, chicken pieces, lemongrass, kaffir lime leaf, turmeric leaf, thin red chili slices.
2. `hero-angle.webp`: 45-degree angle of the same dish with spice-flecked gravy, lemongrass and a red chili slice.
3. `hero-closeup.webp`: macro close-up of one chicken piece in thick shiny gravy with a dripping drop.

## Ingredient cutouts (WebP with alpha, <= 1600px, quality 85)
4. `bahan-santan.webp`: halved brown coconut with white flesh and fresh shreds.
5. `bahan-ayam.webp`: raw free-range chicken (ayam kampung) thigh and drumstick pieces.
6. `bahan-lengkuas.webp`: galangal rhizome with a sliced cross-section.
7. `bahan-jahe.webp`: ginger root with cut slices.
8. `bahan-kunyit.webp`: turmeric roots, one broken open, with turmeric leaves.
9. `bahan-serai.webp`: two lemongrass stalks (one knotted) with kaffir lime leaves.
10. `bahan-daun-salam.webp`: a sprig of Indonesian bay leaves (daun salam).

## Background textures (16:9 WebP, <= 2200px, quality 85)
11. `bg-kayu.webp`: dark walnut wood surface (Peran Setiap Bahan backdrop).
12. `bg-daun-pisang.webp`: banana leaves laid flat (footer backdrop).

## Known minor imperfections (optional regeneration)
- `hero-closeup.webp` is darker and more glazed than the two bowl shots.
- `bahan-ayam.webp` has a small white gap left between two chicken pieces.
- `bahan-santan.webp` has a faint pale edge under the coconut shreds.

## Video
The Proses Memasak section embeds YouTube video `exCLA47ZEFw` through a click-to-load facade. The ID lives in one place: `src/scripts/video-config.js`.
