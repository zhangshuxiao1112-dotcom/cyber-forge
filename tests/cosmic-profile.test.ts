import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHandCosmos,
  generateCosmicNarrative,
  matchCosmicProfile,
} from "../app/cosmic-profile.ts";
import { makeSyntheticHand } from "../app/gesture-engine.ts";

test("open palm landmarks produce a real celestial analogue", () => {
  const hand = makeSyntheticHand("demo-right", 0.5, 0.5, "open");
  const match = classifyHandCosmos(hand);
  assert.ok(match.catalog.length > 1);
  assert.ok(match.feature.includes("星") || match.feature.includes("尘埃"));
  assert.ok(match.signature.openness >= 0.72);
});

test("palm scale and geometry route to distinct cosmic morphologies", () => {
  const andromeda = matchCosmicProfile({
    palmScale: 0.9,
    fingerSpan: 0.8,
    symmetry: 0.7,
    aspect: 0.6,
    openness: 1,
    orientation: 0.5,
  });
  const cartwheel = matchCosmicProfile({
    palmScale: 0.5,
    fingerSpan: 0.86,
    symmetry: 0.9,
    aspect: 0.5,
    openness: 1,
    orientation: 0.5,
  });
  const pillars = matchCosmicProfile({
    palmScale: 0.12,
    fingerSpan: 0.42,
    symmetry: 0.6,
    aspect: 0.5,
    openness: 1,
    orientation: 0.5,
  });
  assert.equal(andromeda.id, "andromeda");
  assert.equal(cartwheel.id, "cartwheel");
  assert.equal(pillars.id, "pillars");
});

test("local generative report is reproducible per seed and varied across seeds", () => {
  const match = matchCosmicProfile({
    palmScale: 0.5,
    fingerSpan: 0.56,
    symmetry: 0.66,
    aspect: 0.56,
    openness: 1,
    orientation: 0.5,
  });
  const first = generateCosmicNarrative(12031, match, 72, 3);
  const repeat = generateCosmicNarrative(12031, match, 72, 3);
  const second = generateCosmicNarrative(994207, match, 45, 7);
  assert.deepEqual(first, repeat);
  assert.equal(first.poem.length, 3);
  assert.notEqual(first.nebulaName + first.poem.join(""), second.nebulaName + second.poem.join(""));
});
