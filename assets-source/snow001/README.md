# Snow001 — ambientCG

Source: https://ambientcg.com/view?id=Snow001
Download: https://ambientcg.com/get?file=Snow001_1K-JPG.zip
License: CC0 1.0 Universal, https://docs.ambientcg.com/license/
Author: ambientCG / Lennart Demes
Retrieved: 2026-10-04

The source describes this as a procedural PBR material, not a photographed scan. Color and OpenGL normal maps are used. Snow001.png is the source preview. No attribution is legally required; provenance is retained here for maintenance.

Run npm run assets:snow with FFmpeg installed to reproduce src/snow-textures.js. It resizes the two original maps to 512×512 with Lanczos and encodes JPEG quality 5. The generated small data URLs are embedded deliberately: browser file:// WebGL image uploads otherwise become cross-origin, and the offline game must keep the same material as the served preview. Each image is below 100 KiB; there are no runtime network requests.
