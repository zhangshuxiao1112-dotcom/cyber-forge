#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${project_root}/node_modules/@mediapipe/hands"
target_dir="${project_root}/public/mediapipe"

[[ -d "${source_dir}" ]] || {
  echo "Missing @mediapipe/hands. Run npm ci first." >&2
  exit 66
}

mkdir -p "${target_dir}"
for file in \
  hand_landmark_full.tflite \
  hand_landmark_lite.tflite \
  hands.binarypb \
  hands.js \
  hands_solution_packed_assets.data \
  hands_solution_packed_assets_loader.js \
  hands_solution_simd_wasm_bin.data \
  hands_solution_simd_wasm_bin.js \
  hands_solution_simd_wasm_bin.wasm \
  hands_solution_wasm_bin.js \
  hands_solution_wasm_bin.wasm
do
  cp "${source_dir}/${file}" "${target_dir}/${file}"
done

echo "MediaPipe assets prepared in public/mediapipe."
