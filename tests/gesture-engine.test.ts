import assert from "node:assert/strict";
import test from "node:test";
import {
  GESTURE_CONFIG,
  makeSyntheticHand,
} from "../app/gesture-engine.ts";

test("normalized pinch ratio separates an open hand from a pinch", () => {
  const open = makeSyntheticHand("demo-left", 0.4, 0.5, "open");
  const pinch = makeSyntheticHand("demo-left", 0.4, 0.5, "pinch");

  assert.ok(open.pinchRatio > GESTURE_CONFIG.pinchRelease);
  assert.ok(pinch.pinchRatio < GESTURE_CONFIG.pinchEnter);
});

test("an open palm satisfies the sustained gate pose", () => {
  const open = makeSyntheticHand("demo-right", 0.5, 0.5, "open");
  const fist = makeSyntheticHand("demo-right", 0.5, 0.5, "fist");
  assert.equal(open.isOpen, true);
  assert.equal(fist.isOpen, false);
  assert.equal(GESTURE_CONFIG.openPalmHoldMs, 2000);
});

test("synthetic poses expose stable high-level signals", () => {
  const fist = makeSyntheticHand("demo-right", 0.6, 0.5, "fist");
  const point = makeSyntheticHand("demo-right", 0.6, 0.5, "point");
  const open = makeSyntheticHand("demo-right", 0.6, 0.5, "open");

  assert.equal(fist.isFist, true);
  assert.equal(point.isPointing, true);
  assert.equal(open.isOpen, true);
});
