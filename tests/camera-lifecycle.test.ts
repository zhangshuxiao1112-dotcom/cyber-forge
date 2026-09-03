import assert from "node:assert/strict";
import test from "node:test";
import { hasLiveCameraPipeline } from "../app/camera-lifecycle.ts";

test("a completed recording does not make a live camera pipeline look inactive", () => {
  assert.equal(
    hasLiveCameraPipeline({
      status: "ready",
      tracks: [{ readyState: "live", enabled: true }],
      runtimeReady: true,
      loopScheduled: true,
    }),
    true,
  );
});

test("restart requests camera recovery when any recognition layer stopped", () => {
  const base = {
    status: "ready",
    tracks: [{ readyState: "live", enabled: true }],
    runtimeReady: true,
    loopScheduled: true,
  };
  assert.equal(hasLiveCameraPipeline({ ...base, tracks: [{ readyState: "ended" }] }), false);
  assert.equal(hasLiveCameraPipeline({ ...base, runtimeReady: false }), false);
  assert.equal(hasLiveCameraPipeline({ ...base, loopScheduled: false }), false);
});
