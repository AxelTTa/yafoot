# Telegram Image Workflow

YaFoot's Telegram bridge already supports incoming images and files.

When Axel sends a photo or image file, `yafoot_bridge.py` downloads it to `/tmp` and includes a marker in the manager prompt:

```text
[IMAGE:/tmp/path.ext]
```

For logo or app icon updates:

1. Use the exact `[IMAGE:/tmp/path.ext]` file path from the manager prompt as the source image.
2. Inspect the image before changing assets.
3. Generate or crop the required icon files from that source only after the image is provided.
4. Update the relevant assets, usually `assets/icon.png`, `assets/adaptive-icon.png`, and App Store screenshots/assets if requested.
5. Run `bash scripts/deploy.sh` so web, native export, OTA, commit, and push stay in sync.

Do not replace the live logo or app icon from a text-only request. A concrete image file must be provided first.
