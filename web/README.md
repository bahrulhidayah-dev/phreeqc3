# Aquos Geochemistry — web interface for PHREEQC

Aquos Geochemistry is a browser app for geochemical modeling. Developed by Rul Hidayah.

The calculations are done by **PHREEQC 3** (D.L. Parkhurst and C.A.J. Appelo, U.S. Geological Survey), compiled to WebAssembly from the unmodified C++ source in `../src`. Everything runs in the user's browser. No server is needed and no data leaves the computer.

## Features

- **Engine:** all 80 PHREEQC keywords, with input written as text, built from templates, or imported from Excel/CSV.
- **Databases:** all 50 databases in `../database` (selectable per project), or your own `.dat` file.
- **Results:**
  - Solutions view with KPIs, a saturation-index chart and species distribution.
  - SELECTED_OUTPUT tables, downloadable as CSV, XLSX or `.sel`.
  - Full output file and messages.
- **Charts:** USER_GRAPH blocks become interactive charts. You can adjust titles, ranges, log axes, secondary Y, legend position, colours, symbols, lines and presets (screen, journal, slide). Charts download as SVG, PNG, PDF or CSV.
- **Interface:** English (default), Japanese and Indonesian; light, dark and system themes; glossary; links to the USGS manual.
- **Projects:** saved in the browser automatically. You can save to or open from a `.aquos` or `.pqi` file, or optionally use Google Drive.
- **Downloads:** files are created only when you click a download button, as in-memory Blobs. Opening a page never links to a file, so download managers such as IDM are not triggered.

## Layout

| Path | Contents |
|---|---|
| `engine/build.sh` | Emscripten build of `../src` into `app/public/engine/phreeqc.{mjs,wasm}` |
| `engine/test/run-example.mjs` | Node runner that checks an example against its `.out` file |
| `app/` | React + TypeScript + Vite app |
| `app/scripts/sync-assets.mjs` | Copies the databases, examples and NOTICE.TXT into `public/`, and writes `manifest.json` |
| `app/tests/` | Unit tests and engine tests (examples ex1–ex22 run through the WASM build) |

## Build

```sh
# 1. Engine (only needed when ../src changes; the built files are committed)
source /path/to/emsdk/emsdk_env.sh      # tested with Emscripten 7.0.1
cd web/app && npm run engine

# 2. App
cd web/app
npm ci
npm test            # unit tests + engine tests on the official examples
npm run dev         # local development server
npm run build       # static site in web/app/dist (copy it to any static host)
```

The output in `dist/` uses relative paths, so it can be served from any folder, for example GitHub Pages.

### Google Drive (optional)

Create an OAuth client ID (type: Web application) in Google Cloud Console and add your site's origin. Then build with:

```sh
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com npm run build
```

The app uses only the `drive.file` scope, which limits it to files the app itself created or that the user opened with it. Without a client ID, the Drive button is hidden and everything else works.

## How USER_GRAPH works here

This WebAssembly build has no Windows chart window. Before each run, the app copies the input and rewrites each `USER_GRAPH` block in that copy into a hidden `SELECTED_OUTPUT` and `USER_PUNCH` pair. The calls `GRAPH_X`, `GRAPH_Y`, `GRAPH_SY` and `PLOT_XY` become tagged `PUNCH` statements. After the run, the app reads the tagged values back and draws the chart. The user's own input is never changed.

## License and source notice

PHREEQC is public domain software of the U.S. Geological Survey. See `../NOTICE.TXT` and https://github.com/usgs-coupled/phreeqc3.

**Statement of changes** (as NOTICE.TXT asks): the PHREEQC engine source (`../src`) is compiled without modification. Everything in `web/` is new: a web interface around the engine, written by Rul Hidayah in 2026. The USGS has not reviewed or endorsed this interface.
