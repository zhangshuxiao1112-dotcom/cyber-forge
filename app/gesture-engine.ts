export type Point = {
  x: number;
  y: number;
  z?: number;
};

export type HandSignal = {
  id: string;
  label: "Left" | "Right" | "Unknown";
  landmarks: Point[];
  wrist: Point;
  palm: Point;
  index: Point;
  thumb: Point;
  palmWidth: number;
  pinchRatio: number;
  openness: number;
  isFist: boolean;
  isOpen: boolean;
  isPointing: boolean;
  angle: number;
};

export const GESTURE_CONFIG = {
  pinchEnter: 0.42,
  pinchRelease: 0.62,
  confirmFrames: 3,
  openThreshold: 0.72,
  fistThreshold: 0.28,
  openPalmHoldMs: 2000,
} as const;

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

function fingerExtended(landmarks: Point[], tip: number, pip: number) {
  const wrist = landmarks[0];
  return distance(landmarks[tip], wrist) >
    distance(landmarks[pip], wrist) * 1.12;
}

export function analyseHand(
  id: string,
  label: HandSignal["label"],
  landmarks: Point[],
): HandSignal | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const palm = midpoint(landmarks[5], landmarks[17]);
  const palmWidth = Math.max(distance(landmarks[5], landmarks[17]), 0.015);
  const extended = [
    distance(landmarks[4], landmarks[2]) >
      distance(landmarks[3], landmarks[2]) * 1.12,
    fingerExtended(landmarks, 8, 6),
    fingerExtended(landmarks, 12, 10),
    fingerExtended(landmarks, 16, 14),
    fingerExtended(landmarks, 20, 18),
  ];
  const openness = extended.filter(Boolean).length / extended.length;
  const pinchRatio = distance(landmarks[4], landmarks[8]) / palmWidth;
  const angle = Math.atan2(
    landmarks[9].y - wrist.y,
    landmarks[9].x - wrist.x,
  );

  return {
    id,
    label,
    landmarks,
    wrist,
    palm,
    index: landmarks[8],
    thumb: landmarks[4],
    palmWidth,
    pinchRatio,
    openness,
    isFist: openness <= GESTURE_CONFIG.fistThreshold,
    isOpen: openness >= GESTURE_CONFIG.openThreshold,
    isPointing: extended[1] && !extended[2] && !extended[3] && !extended[4],
    angle,
  };
}

export function smoothLandmarks(
  previous: Point[] | undefined,
  current: Point[],
  alpha = 0.38,
) {
  if (!previous || previous.length !== current.length) {
    return current.map((point) => ({ ...point }));
  }
  return current.map((point, index) => ({
    x: previous[index].x + (point.x - previous[index].x) * alpha,
    y: previous[index].y + (point.y - previous[index].y) * alpha,
    z:
      (previous[index].z ?? 0) +
      ((point.z ?? 0) - (previous[index].z ?? 0)) * alpha,
  }));
}

export function makeSyntheticHand(
  id: "demo-left" | "demo-right",
  palmX: number,
  palmY: number,
  pose: "open" | "pinch" | "fist" | "point",
): HandSignal {
  const side = id === "demo-left" ? -1 : 1;
  const scale = 0.1;
  const points: Point[] = Array.from({ length: 21 }, () => ({
    x: palmX,
    y: palmY,
  }));

  points[0] = { x: palmX, y: palmY + scale * 1.05 };
  const bases = [-0.72, -0.34, 0.05, 0.42, 0.73];
  const chains = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];

  chains.forEach((chain, finger) => {
    chain.forEach((index, segment) => {
      const x = palmX + bases[finger] * scale * side;
      const openY = palmY + scale * 0.35 - segment * scale * 0.55;
      const curledY =
        palmY + scale * 0.35 - Math.sin((segment / 3) * Math.PI) * scale * 0.45;
      points[index] = {
        x:
          x +
          (pose === "fist" && segment > 1
            ? -bases[finger] * scale * 0.32 * side
            : 0),
        y:
          pose === "fist" ||
          (pose === "point" && finger !== 1)
            ? curledY
            : openY,
      };
    });
  });

  if (pose !== "pinch") {
    points[4] = {
      x: palmX - 1.24 * scale * side,
      y: palmY - scale * 0.36,
    };
  }

  if (pose === "pinch") {
    const contact = { x: palmX, y: palmY - scale * 0.86 };
    points[4] = { x: contact.x - 0.006 * side, y: contact.y + 0.006 };
    points[8] = { x: contact.x + 0.006 * side, y: contact.y - 0.004 };
  }

  const signal = analyseHand(
    id,
    id === "demo-left" ? "Left" : "Right",
    points,
  );
  if (!signal) throw new Error("Unable to create synthetic hand");
  return signal;
}
