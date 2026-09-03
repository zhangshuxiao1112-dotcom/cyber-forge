export type CameraTrackState = {
  readyState: string;
  enabled?: boolean;
};

export type CameraPipelineSnapshot = {
  status: string;
  tracks: readonly CameraTrackState[];
  runtimeReady: boolean;
  loopScheduled: boolean;
};

/** A UI status alone is not enough: every part of the recognition pipeline must still be live. */
export function hasLiveCameraPipeline(snapshot: CameraPipelineSnapshot) {
  return (
    snapshot.status === "ready" &&
    snapshot.runtimeReady &&
    snapshot.loopScheduled &&
    snapshot.tracks.some(
      (track) => track.readyState === "live" && track.enabled !== false,
    )
  );
}
