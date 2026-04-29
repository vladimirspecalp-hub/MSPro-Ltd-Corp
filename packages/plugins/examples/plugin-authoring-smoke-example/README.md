# Plugin Authoring Smoke Example

A MSProLtd plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into MSProLtd

```bash
pnpm msproltdai plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@msproltd/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
