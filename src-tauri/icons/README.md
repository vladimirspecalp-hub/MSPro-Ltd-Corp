# App Icons

Place the following icon files in this directory before building:

| File | Size | Format |
|------|------|--------|
| `32x32.png` | 32×32 px | PNG |
| `128x128.png` | 128×128 px | PNG |
| `128x128@2x.png` | 256×256 px | PNG |
| `icon.icns` | macOS multi-size | ICNS |
| `icon.ico` | Windows multi-size | ICO |

## Generating icons from a source image

With `@tauri-apps/cli` installed:

```bash
pnpm tauri icon path/to/source-1024x1024.png
```

This generates all required sizes automatically.
