#!/usr/bin/env bash
# Rebuilds every .glb in public/models from the Blender scripts (headless).
set -euo pipefail
cd "$(dirname "$0")/.."
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
command -v "$BLENDER" >/dev/null 2>&1 || BLENDER=blender
node scripts/gen_track.mjs
for s in car factory machines characters outdoor; do
  echo "== $s"
  "$BLENDER" --background --factory-startup --python "blender/$s.py" 2>&1 | grep -E "EXPORTED|Error|Traceback" || true
done
