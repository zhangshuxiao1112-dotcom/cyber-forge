import assert from "node:assert/strict";
import test from "node:test";
import { decodeArchivePayload, encodeArchivePayload } from "../app/archive-codec.ts";

const archiveSeed = {
  seed: 3_784_210_992,
  hue: 217,
  duration: 64,
  pressureUsed: 78,
  releases: 9,
  calm: 83,
  palmSignature: {
    palmScale: 0.7134,
    fingerSpan: 0.6288,
    symmetry: 0.8451,
    aspect: 0.5529,
    openness: 0.9412,
    orientation: 0.3887,
  },
};

test("archive QR payload stays compact and round-trips its generation seed", () => {
  const encoded = encodeArchivePayload(archiveSeed);
  const shareUrl = `http://localhost:3000/?archive=${encoded}`;
  assert.ok(encoded.length < 180, `payload unexpectedly grew to ${encoded.length} characters`);
  assert.ok(shareUrl.length < 240, `share URL unexpectedly grew to ${shareUrl.length} characters`);

  const decoded = decodeArchivePayload(encoded);
  assert.equal(decoded?.format, "compact");
  if (!decoded || decoded.format !== "compact") return;
  assert.equal(decoded.data.seed, archiveSeed.seed);
  assert.equal(decoded.data.releases, archiveSeed.releases);
  assert.ok(Math.abs(decoded.data.palmSignature.palmScale - archiveSeed.palmSignature.palmScale) < 0.001);
});

test("archive decoder rejects corrupt or oversized query data", () => {
  assert.equal(decodeArchivePayload("not-base64"), null);
  assert.equal(decodeArchivePayload("a".repeat(12_001)), null);
});
