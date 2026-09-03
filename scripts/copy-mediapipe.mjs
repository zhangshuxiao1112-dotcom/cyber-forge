import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(projectRoot, "node_modules", "@mediapipe", "hands");
const targetDir = join(projectRoot, "public", "mediapipe");

const files = [
  "hand_landmark_full.tflite",
  "hand_landmark_lite.tflite",
  "hands.binarypb",
  "hands.js",
  "hands_solution_packed_assets.data",
  "hands_solution_packed_assets_loader.js",
  "hands_solution_simd_wasm_bin.data",
  "hands_solution_simd_wasm_bin.js",
  "hands_solution_simd_wasm_bin.wasm",
  "hands_solution_wasm_bin.js",
  "hands_solution_wasm_bin.wasm",
];

try {
  await access(sourceDir, constants.R_OK);
} catch {
  console.error("Missing @mediapipe/hands. Run npm ci first.");
  process.exit(66);
}

await mkdir(targetDir, { recursive: true });
await Promise.all(
  files.map((file) => copyFile(join(sourceDir, file), join(targetDir, file))),
);

console.log("MediaPipe assets prepared in public/mediapipe.");
