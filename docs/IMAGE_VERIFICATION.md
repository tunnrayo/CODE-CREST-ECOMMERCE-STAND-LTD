# Product image verification

The sandbox used to build this project could not download third-party photos, so every product ships with an **original Code Crest illustration** (`public/products/*.webp`, source `ORIGINAL_ILLUSTRATION`, licence `OWNED`, verification `PENDING`). They are placeholders, not product photography.

Admin → Images lists every product with source, permission and verification state (also `GET /api/v1/admin/images/report`). To replace an image: open the product, upload a JPEG/PNG/WebP (≤5 MB), record the source name/URL and permission (`OWNED`, `PERMITTED`, `LICENSED`), then set verification to `VERIFIED` once checked. Only use images you own, have written permission for, or have licensed.
