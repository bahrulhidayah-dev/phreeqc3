#!/usr/bin/env bash
# Builds the unmodified PHREEQC 3 engine (../../src) to WebAssembly with Emscripten.
# Output: web/app/public/engine/phreeqc.mjs + phreeqc.wasm
# Requires: emsdk activated (source /path/to/emsdk/emsdk_env.sh)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$ROOT/web/app/public/engine"
OBJ="$HERE/obj"
mkdir -p "$OUT" "$OBJ"

mapfile -t SOURCES < <(cd "$ROOT" && ls src/*.cpp src/*.cxx src/common/*.cpp src/common/*.cxx src/PhreeqcKeywords/*.cpp | grep -v 'cl1mp.cpp')
CXXFLAGS=(-O2 -fwasm-exceptions -DNDEBUG -I"$ROOT/src" -I"$ROOT/src/common" -I"$ROOT/src/PhreeqcKeywords" -w)

objs=()
for s in "${SOURCES[@]}"; do
  o="$OBJ/$(echo "$s" | tr '/' '_').o"
  if [[ ! -f "$o" || "$ROOT/$s" -nt "$o" ]]; then
    echo "  CXX $s"
    em++ "${CXXFLAGS[@]}" -c "$ROOT/$s" -o "$o" &
    while (( $(jobs -r | wc -l) >= $(nproc) )); do sleep 0.2; done
  fi
  objs+=("$o")
done
wait

em++ -O2 -fwasm-exceptions "${objs[@]}" -o "$OUT/phreeqc.mjs" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createPhreeqc \
  -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sSTACK_SIZE=4MB \
  -sENVIRONMENT=web,worker,node -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,callMain
echo "Built $OUT/phreeqc.mjs ($(du -h "$OUT/phreeqc.wasm" | cut -f1) wasm)"
