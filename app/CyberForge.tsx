"use client";
/* eslint-disable @next/next/no-img-element -- Generated poster and QR are local data URLs. */

import QRCode from "qrcode";
import { decodeArchivePayload, encodeArchivePayload } from "./archive-codec";
import { hasLiveCameraPipeline } from "./camera-lifecycle";
import {
  classifyHandCosmos,
  DEFAULT_COSMIC_MATCH,
  generateCosmicNarrative,
  JointShape,
  matchCosmicProfile,
  PalmCosmicMatch,
} from "./cosmic-profile";
import {
  analyseHand,
  distance,
  GESTURE_CONFIG,
  HandSignal,
  makeSyntheticHand,
  Point,
  smoothLandmarks,
} from "./gesture-engine";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Stage = "idle" | "calibrating" | "forging" | "portal" | "result";
type Language = "zh" | "en";
type CameraStatus =
  | "idle"
  | "loading"
  | "ready"
  | "denied"
  | "unsupported";
type DemoPose = "open" | "pinch" | "fist" | "point";
type CosmicCue = "wake" | "pinch" | "release" | "portal" | "archive";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  orbit: number;
};

type Shockwave = {
  x: number;
  y: number;
  radius: number;
  life: number;
  hue: number;
};

type TrailPoint = {
  x: number;
  y: number;
  life: number;
  hue: number;
};

type Metrics = {
  startedAt: number;
  finishedAt: number;
  releases: number;
  compression: number;
  expansion: number;
  movement: number;
  calmFrames: number;
  activeFrames: number;
  maxCharge: number;
  hue: number;
  portalOpened: boolean;
};

type ArchiveResult = {
  seed: number;
  name: string;
  generationId: string;
  identity: string;
  pattern: string;
  hue: number;
  duration: number;
  pressureUsed: number;
  releases: number;
  calm: number;
  inscription: string;
  poem: [string, string, string];
  realObject: string;
  realCatalog: string;
  objectType: string;
  realFeature: string;
  matchReason: string;
  narrative: string;
  inspiration: string[];
  palmSignature: PalmCosmicMatch["signature"];
};

type RuntimeHands = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: MediaPipeResults) => void) => void;
  send: (input: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
  close?: () => void;
};

type MediaPipeResults = {
  multiHandLandmarks?: Point[][];
  multiHandedness?: Array<{ label?: string; score?: number }>;
};

declare global {
  interface Window {
    Hands?: new (options: { locateFile: (file: string) => string }) => RuntimeHands;
  }
}

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function publicAsset(path: string) {
  return `${APP_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

const HANDS_SCRIPT_URL = publicAsset("/mediapipe/hands.js");

function loadHandsRuntime() {
  if (window.Hands) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${HANDS_SCRIPT_URL}"]`);
    // A failed first attempt can leave a script element behind without
    // exposing window.Hands. Remove it so a retry reloads the local runtime.
    existing?.remove();
    const script = document.createElement("script");
    const timer = window.setTimeout(() => reject(new Error("本地 MediaPipe 脚本加载超时")), 15000);
    script.addEventListener("load", () => {
      window.clearTimeout(timer);
      if (window.Hands) resolve();
      else reject(new Error("MediaPipe 脚本已载入，但 Hands 构造器不可用"));
    }, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timer);
      reject(new Error("无法读取 /mediapipe/hands.js"));
    }, { once: true });
    script.src = HANDS_SCRIPT_URL;
    document.head.appendChild(script);
  });
}

const COPY = {
  zh: {
    forge: "宇宙余息",
    product: "CYBER FORGE / PRESSURE ARCHIVE",
    line1: "在压差消失以前，留下你的思想形状",
    line2: "伸出一只手，唤醒宇宙锻造舱。",
    start: "启动锻造舱",
    demo: "无需摄像头 · 体验演示",
    privacy: "默认不保存摄像头画面，仅在本机分析手部关键点",
    cameraLoading: "正在加载手势识别模型…",
    cameraDenied: "无法使用摄像头。你仍可进入演示模式体验完整流程。",
    scanning: "全息扫描已启动",
    calibration: "校准手掌尺度与活动范围",
    calibrationHint: "请自然张开一只手，并缓慢移动",
    forging: "星核锻造",
    portal: "跨宇宙压力通道",
    equilibrium: "完全平衡",
    pressure: "剩余压差",
    energy: "星核能量",
    entropy: "熵增记录",
    handSignal: "手部信号",
    noHands: "等待手掌进入扫描区",
    oneHand: "单手链路稳定",
    taskPinch: "捏合指尖，捕获高压空气",
    taskRelease: "松开指尖，释放思想气流",
    taskCompress: "保持完整手掌张开2秒，启动星门",
    taskExpand: "保持完整手掌张开2秒，启动星门",
    taskPortal: "保持手掌展开，穿越正在发生",
    settings: "展台控制",
    sound: "声音",
    debug: "调试骨架",
    density: "粒子密度",
    fullscreen: "全屏",
    reset: "重置体验",
    archive: "个人星系档案",
    downloadPoster: "下载星系档案",
    downloadVideo: "下载 5 秒星门影像",
    copyLink: "复制分享链接",
    copied: "链接已复制",
    again: "锻造另一个宇宙",
    identity: "宇宙身份",
    pattern: "思想结构",
    lifetime: "宇宙持续",
    consumed: "余息消耗",
    calm: "稳定节奏",
    shareHint: "扫描二维码，在另一台设备打开这份宇宙档案",
    demoControl: "演示控制",
    pinch: "捏合",
    release: "松开",
    fist: "握拳",
    compress: "保持张掌",
    expand: "开启星门",
    raise: "举起一只手",
    exitDemo: "退出演示",
    cameraReady: "模型就绪 · 等待一只手",
    modelError: "手势模型未能加载，已为你保留演示入口。",
    handTest: "先测试摄像头与手势",
    handTestExit: "退出手势测试",
    permission: "浏览器需要一次摄像头授权才能开始识别",
    finishEarly: "完成并生成档案",
  },
  en: {
    forge: "THE PRESSURE ARCHIVE",
    product: "CYBER FORGE / PRESSURE ARCHIVE",
    line1: "Before the pressure fades, leave the shape of your thought.",
    line2: "Raise one hand. Wake the cosmic forge.",
    start: "Activate the forge",
    demo: "Try without camera",
    privacy: "Camera frames stay on this device; only hand landmarks are analyzed",
    cameraLoading: "Loading hand tracking model…",
    cameraDenied:
      "Camera unavailable. Demo mode still provides the complete experience.",
    scanning: "Holographic scan active",
    calibration: "Calibrating hand scale and movement range",
    calibrationHint: "Open one hand naturally and move it slowly",
    forging: "Star-core forging",
    portal: "Inter-universe pressure channel",
    equilibrium: "Perfect equilibrium",
    pressure: "Pressure remaining",
    energy: "Core energy",
    entropy: "Entropy record",
    handSignal: "Hand signal",
    noHands: "Waiting for one hand",
    oneHand: "Single-hand link stable",
    taskPinch: "Pinch to capture high-pressure air",
    taskRelease: "Release to emit a thought current",
    taskCompress: "Hold a fully open palm for 2 seconds to open the gate",
    taskExpand: "Hold a fully open palm for 2 seconds to open the gate",
    taskPortal: "Keep your palm open. Transit in progress",
    settings: "Kiosk controls",
    sound: "Sound",
    debug: "Debug skeleton",
    density: "Particle density",
    fullscreen: "Fullscreen",
    reset: "Reset experience",
    archive: "Personal galaxy archive",
    downloadPoster: "Download archive",
    downloadVideo: "Download 5s gate film",
    copyLink: "Copy share link",
    copied: "Link copied",
    again: "Forge another universe",
    identity: "Cosmic identity",
    pattern: "Thought structure",
    lifetime: "Universe lifetime",
    consumed: "Breath consumed",
    calm: "Stable rhythm",
    shareHint: "Scan to open this archive on another device",
    demoControl: "Demo controls",
    pinch: "Pinch",
    release: "Release",
    fist: "Hold fist",
    compress: "Hold open palm",
    expand: "Open gate",
    raise: "Raise one hand",
    exitDemo: "Exit demo",
    cameraReady: "Model ready · waiting for one hand",
    modelError: "The hand model did not load. Demo mode remains available.",
    handTest: "Test camera & gestures first",
    handTestExit: "Exit hand test",
    permission: "One-time camera permission is required for hand tracking",
    finishEarly: "Complete & archive",
  },
} as const;

const CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;

const INITIAL_METRICS: Metrics = {
  startedAt: 0,
  finishedAt: 0,
  releases: 0,
  compression: 0,
  expansion: 0,
  movement: 0,
  calmFrames: 0,
  activeFrames: 0,
  maxCharge: 0,
  hue: 193,
  portalOpened: false,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function encodeArchive(result: ArchiveResult) {
  return encodeArchivePayload(result);
}

function decodeArchive(value: string): ArchiveResult | null {
  const decoded = decodeArchivePayload(value);
  if (!decoded) return null;
  try {
    if (decoded.format === "compact") {
      const parsed = decoded.data;
      const cosmicMatch = matchCosmicProfile(parsed.palmSignature);
      const generated = generateCosmicNarrative(
        parsed.seed,
        cosmicMatch,
        parsed.calm,
        parsed.releases,
      );
      return {
        ...parsed,
        name: generated.nebulaName,
        generationId: generated.generationId,
        identity: generated.identity,
        pattern: generated.pattern,
        inscription: generated.poem.join(" "),
        poem: generated.poem,
        realObject: `${cosmicMatch.nameZh} / ${cosmicMatch.nameEn}`,
        realCatalog: cosmicMatch.catalog,
        objectType: cosmicMatch.objectType,
        realFeature: cosmicMatch.feature,
        matchReason: cosmicMatch.matchReason,
        narrative: generated.narrative,
        inspiration: generated.inspiration,
      };
    }
    const parsed = decoded.data as Partial<ArchiveResult>;
    if (typeof parsed.seed !== "number" || !parsed.name) return null;
    const cosmicMatch = matchCosmicProfile(
      parsed.palmSignature ?? DEFAULT_COSMIC_MATCH.signature,
    );
    const generated = generateCosmicNarrative(
      parsed.seed,
      cosmicMatch,
      parsed.calm ?? 50,
      parsed.releases ?? 0,
    );
    return {
      seed: parsed.seed,
      name: parsed.name,
      generationId: parsed.generationId ?? generated.generationId,
      identity: parsed.identity ?? generated.identity,
      pattern: parsed.pattern ?? generated.pattern,
      hue: parsed.hue ?? 193,
      duration: parsed.duration ?? 8,
      pressureUsed: parsed.pressureUsed ?? 0,
      releases: parsed.releases ?? 0,
      calm: parsed.calm ?? 50,
      inscription: parsed.inscription ?? generated.poem.join(" "),
      poem: parsed.poem ?? generated.poem,
      realObject: parsed.realObject ?? `${cosmicMatch.nameZh} / ${cosmicMatch.nameEn}`,
      realCatalog: parsed.realCatalog ?? cosmicMatch.catalog,
      objectType: parsed.objectType ?? cosmicMatch.objectType,
      realFeature: parsed.realFeature ?? cosmicMatch.feature,
      matchReason: parsed.matchReason ?? cosmicMatch.matchReason,
      narrative: parsed.narrative ?? generated.narrative,
      inspiration: parsed.inspiration ?? generated.inspiration,
      palmSignature: parsed.palmSignature ?? cosmicMatch.signature,
    };
  } catch {
    return null;
  }
}

function createArchiveResult(
  metrics: Metrics,
  pressure: number,
  cosmicMatch: PalmCosmicMatch,
  entropy: number,
): ArchiveResult {
  const duration = Math.max(
    8,
    Math.round((metrics.finishedAt - metrics.startedAt) / 1000),
  );
  const gestureSeed = Math.floor(
    metrics.movement * 991 +
      metrics.releases * 331 +
      metrics.compression * 17 +
      duration * 73,
  );
  const seed = Math.abs((gestureSeed ^ entropy ^ Date.now()) >>> 0);
  const calm = Math.round(
    (metrics.calmFrames / Math.max(metrics.activeFrames, 1)) * 100,
  );
  const generated = generateCosmicNarrative(seed, cosmicMatch, calm, metrics.releases);

  return {
    seed,
    name: generated.nebulaName,
    generationId: generated.generationId,
    identity: generated.identity,
    pattern: generated.pattern,
    hue: Math.round(metrics.hue),
    duration,
    pressureUsed: Math.round(100 - pressure),
    releases: metrics.releases,
    calm,
    inscription: generated.poem.join(" "),
    poem: generated.poem,
    realObject: `${cosmicMatch.nameZh} / ${cosmicMatch.nameEn}`,
    realCatalog: cosmicMatch.catalog,
    objectType: cosmicMatch.objectType,
    realFeature: cosmicMatch.feature,
    matchReason: cosmicMatch.matchReason,
    narrative: generated.narrative,
    inspiration: generated.inspiration,
    palmSignature: cosmicMatch.signature,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function CyberForge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<Stage>("idle");
  const [stage, setStage] = useState<Stage>("idle");
  const [language, setLanguage] = useState<Language>("zh");
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [debug, setDebug] = useState(false);
  const [handTest, setHandTest] = useState(false);
  const handTestRef = useRef(false);
  const [diagnostic, setDiagnostic] = useState("等待摄像头");
  const [density, setDensity] = useState(1);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);
  const [demoPose, setDemoPose] = useState<DemoPose>("open");
  const demoPoseRef = useRef<DemoPose>("open");
  const [pressure, setPressure] = useState(100);
  const pressureRef = useRef(100);
  const [energy, setEnergy] = useState(0);
  const energyRef = useRef(0);
  const [releaseCount, setReleaseCount] = useState(0);
  const [openPalmProgress, setOpenPalmProgress] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const calibrationStartedRef = useRef(0);
  const [handCount, setHandCount] = useState(0);
  const [mission, setMission] = useState(0);
  const missionRef = useRef(0);
  const [archive, setArchive] = useState<ArchiveResult | null>(null);
  const [posterUrl, setPosterUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const latestHandsRef = useRef<HandSignal[]>([]);
  const smoothedRef = useRef<Record<string, Point[]>>({});
  const handsRuntimeRef = useRef<RuntimeHands | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraLoopRef = useRef<number | null>(null);
  const cameraSessionRef = useRef(0);
  const detectionBusyRef = useRef(false);
  const diagnosticAtRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const trailsRef = useRef<TrailPoint[]>([]);
  const metricsRef = useRef<Metrics>({ ...INITIAL_METRICS });
  const previousPalmsRef = useRef<Record<string, Point>>({});
  const pinchStateRef = useRef<
    Record<string, { pinched: boolean; enter: number; release: number }>
  >({});
  const compressionActiveRef = useRef(false);
  const portalArmedRef = useRef(false);
  const openPalmStartedRef = useRef(0);
  const lastReleaseRef = useRef(0);
  const stageTimerRef = useRef(0);
  const recordingRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const lastHudUpdateRef = useRef(0);
  const archiveRef = useRef<ArchiveResult | null>(null);
  const cosmicMatchRef = useRef<PalmCosmicMatch>(DEFAULT_COSMIC_MATCH);
  const [cosmicMatch, setCosmicMatch] = useState<PalmCosmicMatch>(DEFAULT_COSMIC_MATCH);
  const t = COPY[language];

  const setStageBoth = useCallback((next: Stage) => {
    stageRef.current = next;
    stageTimerRef.current = performance.now();
    setStage(next);
  }, []);

  const playTone = useCallback(
    (frequency: number, duration = 0.16, gain = 0.05, type: OscillatorType = "sine") => {
      if (!soundOn) return;
      try {
        const audio =
          audioRef.current ??
          new AudioContext({ latencyHint: "interactive" });
        audioRef.current = audio;
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(55, frequency * 0.72),
          audio.currentTime + duration,
        );
        volume.gain.setValueAtTime(gain, audio.currentTime);
        volume.gain.exponentialRampToValueAtTime(
          0.0001,
          audio.currentTime + duration,
        );
        oscillator.connect(volume).connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + duration);
      } catch {
        // Audio feedback is optional; the visual interaction remains complete.
      }
    },
    [soundOn],
  );

  const playCosmicCue = useCallback((cue: CosmicCue, intensity = 1) => {
    if (!soundOn) return;
    try {
      const audio = audioRef.current ?? new AudioContext({ latencyHint: "interactive" });
      audioRef.current = audio;
      if (audio.state === "suspended") void audio.resume();
      const now = audio.currentTime;
      const master = audio.createGain();
      const filter = audio.createBiquadFilter();
      const delay = audio.createDelay(1.4);
      const feedback = audio.createGain();
      const wet = audio.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.1 * intensity, now + 0.025);
      master.gain.exponentialRampToValueAtTime(0.0001, now + (cue === "portal" ? 2.8 : 1.35));
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cue === "pinch" ? 720 : 2100, now);
      filter.Q.value = 4.2;
      delay.delayTime.value = cue === "portal" ? 0.32 : 0.17;
      feedback.gain.value = cue === "portal" ? 0.42 : 0.22;
      wet.gain.value = 0.32;
      master.connect(filter).connect(audio.destination);
      filter.connect(delay).connect(wet).connect(audio.destination);
      delay.connect(feedback).connect(delay);

      const schedules: Record<CosmicCue, Array<[number, number, number, OscillatorType]>> = {
        wake: [[92, 184, 0.9, "sine"], [277, 415, 0.65, "triangle"]],
        pinch: [[126, 56, 0.72, "sine"], [520, 312, 0.38, "triangle"], [803, 466, 0.25, "sine"]],
        release: [[220, 660, 0.78, "sine"], [440, 990, 0.68, "triangle"], [880, 1320, 0.48, "sine"]],
        portal: [[52, 36, 2.7, "sine"], [148, 740, 2.25, "sawtooth"], [392, 1176, 1.8, "triangle"]],
        archive: [[196, 294, 1.2, "sine"], [294, 441, 1.15, "triangle"], [392, 784, 1.05, "sine"]],
      };
      schedules[cue].forEach(([from, to, duration, type], index) => {
        const oscillator = audio.createOscillator();
        const voice = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now + index * 0.035);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, to), now + duration);
        voice.gain.setValueAtTime(0.0001, now);
        voice.gain.exponentialRampToValueAtTime(0.45 / (index + 1), now + 0.035 + index * 0.035);
        voice.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(voice).connect(master);
        oscillator.start(now + index * 0.035);
        oscillator.stop(now + duration + 0.08);
      });

      if (cue === "release" || cue === "portal") {
        const length = Math.floor(audio.sampleRate * (cue === "portal" ? 1.8 : 0.72));
        const buffer = audio.createBuffer(1, length, audio.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let index = 0; index < length; index += 1) {
          const envelope = 1 - index / length;
          channel[index] = (Math.random() * 2 - 1) * envelope * envelope;
        }
        const noise = audio.createBufferSource();
        const noiseFilter = audio.createBiquadFilter();
        const noiseGain = audio.createGain();
        noise.buffer = buffer;
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(180, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(cue === "portal" ? 4200 : 2400, now + 0.68);
        noiseFilter.Q.value = 7;
        noiseGain.gain.value = cue === "portal" ? 0.16 : 0.1;
        noise.connect(noiseFilter).connect(noiseGain).connect(master);
        noise.start(now);
      }
    } catch {
      // The installation remains fully usable when Web Audio is unavailable.
    }
  }, [soundOn]);

  const spawnBurst = useCallback(
    (x: number, y: number, hue: number, force = 1) => {
      const count = Math.round(54 * density * force);
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + Math.random() * 0.16;
        const speed = (0.8 + Math.random() * 3.2) * force;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.9 + Math.random() * 1.8,
          size: 1.4 + Math.random() * 3.8,
          hue: hue + Math.random() * 38 - 19,
          orbit: Math.random() * Math.PI * 2,
        });
      }
      shockwavesRef.current.push({ x, y, radius: 8, life: 1, hue });
    },
    [density],
  );

  const stopCamera = useCallback(() => {
    cameraSessionRef.current += 1;
    if (cameraLoopRef.current !== null) {
      cancelAnimationFrame(cameraLoopRef.current);
      cameraLoopRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    handsRuntimeRef.current?.close?.();
    handsRuntimeRef.current = null;
    detectionBusyRef.current = false;
    latestHandsRef.current = [];
    smoothedRef.current = {};
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const beginCalibration = useCallback(() => {
    calibrationStartedRef.current = performance.now();
    setCalibrationProgress(0);
    setStageBoth("calibrating");
    playCosmicCue("wake", 0.52);
  }, [playCosmicCue, setStageBoth]);

  const processResults = useCallback((results: MediaPipeResults) => {
    const signals: HandSignal[] = [];
    const candidates = (results.multiHandLandmarks ?? [])
      .map((landmarks, index) => ({
        landmarks,
        handedness: results.multiHandedness?.[index],
      }))
      .filter((candidate) => candidate.landmarks.length >= 21)
      .sort((a, b) => (b.handedness?.score ?? 0) - (a.handedness?.score ?? 0));
    candidates.slice(0, 1).forEach(({ landmarks, handedness }) => {
      const rawLabel = handedness?.label;
      const label: HandSignal["label"] = rawLabel === "Left" || rawLabel === "Right" ? rawLabel : "Unknown";
      const id = "primary-hand";
      const mirrored = landmarks.map((point) => ({
        x: 1 - point.x,
        y: point.y,
        z: point.z,
      }));
      const smoothed = smoothLandmarks(smoothedRef.current[id], mirrored, 0.46);
      smoothedRef.current[id] = smoothed;
      const signal = analyseHand(id, label, smoothed);
      if (signal) signals.push(signal);
    });
    latestHandsRef.current = signals;
    const now = performance.now();
    if (now - diagnosticAtRef.current > 100) {
      diagnosticAtRef.current = now;
      const details = signals.map((hand, index) =>
        `手${index + 1} 捏合=${hand.pinchRatio.toFixed(2)} 张开=${hand.openness.toFixed(2)} 星图=${classifyHandCosmos(hand).catalog}`,
      );
      setDiagnostic(signals.length ? `单手锁定 · ${details.join(" · ")}` : "未识别到手");
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    const sessionId = cameraSessionRef.current;
    playTone(180, 0.04, 0.0001, "sine");
    setCameraStatus("loading");
    demoModeRef.current = false;
    setDemoMode(false);
    try {
      setDiagnostic("正在读取本地 MediaPipe 识别引擎");
      await loadHandsRuntime();
      if (cameraSessionRef.current !== sessionId) return;
      if (!window.Hands) throw new Error("本地 MediaPipe Hands 不可用");
      const runtime = new window.Hands({
        locateFile: (file) => publicAsset(`/mediapipe/${file}`),
      });
      runtime.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.52,
        selfieMode: true,
      });
      runtime.onResults(processResults);
      handsRuntimeRef.current = runtime;

      setDiagnostic("本地识别引擎已载入 · 正在执行模型自检");
      const selfTestCanvas = document.createElement("canvas");
      selfTestCanvas.width = 320;
      selfTestCanvas.height = 240;
      const selfTestContext = selfTestCanvas.getContext("2d");
      if (!selfTestContext) throw new Error("无法创建模型自检画布");
      selfTestContext.fillStyle = "#000";
      selfTestContext.fillRect(0, 0, 320, 240);
      await Promise.race([
        runtime.send({ image: selfTestCanvas }),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("本地模型自检超时")), 30000),
        ),
      ]);
      if (cameraSessionRef.current !== sessionId) {
        runtime.close?.();
        return;
      }
      setDiagnostic("本地模型自检通过 · 正在启动摄像头");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("当前浏览器环境没有可用的摄像头接口");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 960 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });
      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        runtime.close?.();
        return;
      }
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video surface unavailable");
      video.srcObject = stream;
      await video.play();
      setDiagnostic("本地模型已载入 · 正在等待手掌");

      const detect = async () => {
        if (cameraSessionRef.current !== sessionId) return;
        if (
          handsRuntimeRef.current === runtime &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          !detectionBusyRef.current
        ) {
          detectionBusyRef.current = true;
          try {
            await runtime.send({ image: video });
          } catch (error) {
            console.error("MediaPipe frame processing failed:", error);
            setDiagnostic(error instanceof Error ? `帧处理失败：${error.message}` : "帧处理失败");
          } finally {
            detectionBusyRef.current = false;
          }
        }
        if (cameraSessionRef.current === sessionId) {
          cameraLoopRef.current = requestAnimationFrame(detect);
        }
      };
      cameraLoopRef.current = requestAnimationFrame(detect);
      setCameraStatus("ready");
      if (!handTestRef.current) beginCalibration();
    } catch (error) {
      if (cameraSessionRef.current !== sessionId) return;
      console.error("Cyber Forge MediaPipe initialization failed:", error);
      setDiagnostic(error instanceof Error ? error.message : String(error));
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setCameraStatus(denied ? "denied" : "unsupported");
      stopCamera();
    }
  }, [beginCalibration, playTone, processResults, stopCamera]);

  const startHandTest = useCallback(async () => {
    handTestRef.current = true;
    setHandTest(true);
    setDebug(true);
    await startCamera();
  }, [startCamera]);

  const startDemo = useCallback(() => {
    stopCamera();
    demoModeRef.current = true;
    setDemoMode(true);
    setCameraStatus("idle");
    demoPoseRef.current = "open";
    setDemoPose("open");
    beginCalibration();
  }, [beginCalibration, stopCamera]);

  const startPortalRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === "undefined") return;
    try {
      const stream = canvas.captureStream(30);
      const preferred = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred, videoBitsPerSecond: 4_500_000 } : {},
      );
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        setVideoUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
      };
      recorder.start(500);
      recordingRef.current = recorder;
    } catch {
      recordingRef.current = null;
    }
  }, []);

  const openPortal = useCallback(() => {
    if (stageRef.current !== "forging") return;
    metricsRef.current.portalOpened = true;
    energyRef.current = Math.max(energyRef.current, 78);
    setEnergy(Math.round(energyRef.current));
    setStageBoth("portal");
    startPortalRecording();
    playCosmicCue("portal", 0.9);
  }, [playCosmicCue, setStageBoth, startPortalRecording]);

  const buildPoster = useCallback(
    async (result: ArchiveResult, qrDataUrl: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 1900;
      const context = canvas.getContext("2d");
      if (!context) return "";
      const { width, height } = canvas;
      const drawWrappedText = (
        value: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
        maxLines = 4,
      ) => {
        let line = "";
        let lineIndex = 0;
        for (const character of value) {
          const candidate = line + character;
          if (context.measureText(candidate).width > maxWidth && line) {
            context.fillText(line, x, y + lineIndex * lineHeight);
            line = character;
            lineIndex += 1;
            if (lineIndex >= maxLines) return y + lineIndex * lineHeight;
          } else {
            line = candidate;
          }
        }
        if (line && lineIndex < maxLines) {
          context.fillText(line, x, y + lineIndex * lineHeight);
          lineIndex += 1;
        }
        return y + lineIndex * lineHeight;
      };
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#02070f");
      background.addColorStop(0.54, "#06151d");
      background.addColorStop(1, "#030509");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < 340; index += 1) {
        const x = seeded(result.seed + index * 4.11) * width;
        const y = seeded(result.seed + index * 9.73) * height;
        const radius = 0.5 + seeded(result.seed + index * 2.47) * 2.2;
        context.fillStyle = `hsla(${result.hue + (index % 3) * 22}, 90%, 78%, ${
          0.18 + seeded(index + result.seed) * 0.55
        })`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      context.save();
      context.translate(width / 2, 650);
      for (let ring = 10; ring > 0; ring -= 1) {
        const radius = ring * 38;
        const glow = context.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        glow.addColorStop(0, `hsla(${result.hue}, 95%, 72%, 0.04)`);
        glow.addColorStop(
          0.72,
          `hsla(${result.hue + ring * 4}, 90%, 55%, ${0.025 + ring * 0.008})`,
        );
        glow.addColorStop(1, "transparent");
        context.fillStyle = glow;
        context.beginPath();
        context.ellipse(
          0,
          0,
          radius * (0.84 + seeded(result.seed + ring) * 0.26),
          radius * 0.38,
          seeded(result.seed + ring * 2) * Math.PI,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      context.strokeStyle = `hsla(${result.hue + 18}, 94%, 72%, .82)`;
      context.lineWidth = 2;
      for (let orbit = 0; orbit < 7; orbit += 1) {
        context.beginPath();
        context.ellipse(
          0,
          0,
          150 + orbit * 42,
          48 + orbit * 16,
          seeded(result.seed + orbit * 8) * Math.PI,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.restore();

      context.fillStyle = "#b8f7ff";
      context.font = "600 24px ui-monospace, monospace";
      context.letterSpacing = "6px";
      context.fillText("CYBER FORGE / PERSONAL COSMOS ARCHIVE", 82, 92);
      context.fillStyle = "#f4fbff";
      context.font = `700 ${result.name.length > 16 ? 56 : 76}px Arial, sans-serif`;
      context.fillText(result.name, 78, 195);
      context.fillStyle = "rgba(226, 246, 250, .68)";
      context.font = "400 26px Arial, sans-serif";
      context.fillText(result.identity, 82, 246);

      context.fillStyle = "rgba(162, 229, 238, .72)";
      context.font = "600 21px ui-monospace, monospace";
      context.fillText(`REAL CELESTIAL MATCH / ${result.realCatalog}`, 88, 1060);
      context.fillStyle = "#f2fbfc";
      context.font = "600 38px Arial, sans-serif";
      context.fillText(result.realObject, 88, 1110);
      context.fillStyle = "rgba(196, 232, 237, .62)";
      context.font = "400 23px Arial, sans-serif";
      drawWrappedText(result.narrative, 88, 1154, 1220, 35, 4);

      context.strokeStyle = "rgba(126, 231, 242, .28)";
      context.strokeRect(72, 1320, 1256, 250);
      context.fillStyle = "#8eaeb5";
      context.font = "500 20px ui-monospace, monospace";
      context.fillText("THOUGHT STRUCTURE", 104, 1368);
      context.fillText("UNIVERSE LIFETIME", 104, 1468);
      context.fillText("BREATH CONSUMED", 500, 1468);
      context.fillText("STABLE RHYTHM", 900, 1468);
      context.fillStyle = "#f1fbfc";
      context.font = "600 30px Arial, sans-serif";
      context.fillText(result.pattern, 104, 1410);
      context.font = "600 46px Arial, sans-serif";
      context.fillText(`${result.duration}s`, 104, 1530);
      context.fillText(`${result.pressureUsed}%`, 500, 1530);
      context.fillText(`${result.calm}%`, 900, 1530);

      context.fillStyle = "rgba(139, 225, 237, .66)";
      context.font = "600 18px ui-monospace, monospace";
      context.fillText("GENERATIVE VERSE / ORIGINAL LOCAL SYNTHESIS", 88, 1642);
      context.fillStyle = "rgba(235, 249, 250, .82)";
      context.font = "400 25px 'Songti SC', serif";
      (result.poem ?? [result.inscription]).forEach((line, index) => {
        drawWrappedText(line, 88, 1690 + index * 58, 1200, 34, 2);
      });

      context.fillStyle = "rgba(150, 207, 214, .46)";
      context.font = "500 17px ui-monospace, monospace";
      context.fillText(`GEN ${result.generationId} · ${result.inspiration.join(" / ")}`, 88, 1850);

      if (qrDataUrl) {
        const qr = new Image();
        await new Promise<void>((resolve) => {
          qr.onload = () => resolve();
          qr.onerror = () => resolve();
          qr.src = qrDataUrl;
        });
        if (qr.complete && qr.naturalWidth) {
          context.fillStyle = "#f3fbfc";
          context.fillRect(1155, 70, 170, 170);
          context.drawImage(qr, 1165, 80, 150, 150);
        }
      }
      return canvas.toDataURL("image/png");
    },
    [],
  );

  const finishExperience = useCallback(async () => {
    if (stageRef.current === "result") return;
    metricsRef.current.finishedAt = performance.now();
    const entropyBuffer = new Uint32Array(1);
    crypto.getRandomValues(entropyBuffer);
    const result = createArchiveResult(
      metricsRef.current,
      pressureRef.current,
      cosmicMatchRef.current,
      entropyBuffer[0],
    );
    archiveRef.current = result;
    setArchive(result);
    setStageBoth("result");
    if (recordingRef.current?.state === "recording") {
      recordingRef.current.stop();
    }
    const encoded = encodeArchive(result);
    const url = `${window.location.origin}${window.location.pathname}?archive=${encodeURIComponent(encoded)}`;
    setShareUrl(url);
    try {
      const qr = await QRCode.toDataURL(url, {
        width: 240,
        margin: 1,
        color: { dark: "#06151d", light: "#f3fbfc" },
        errorCorrectionLevel: "L",
      });
      setQrUrl(qr);
      setPosterUrl(await buildPoster(result, qr));
    } catch (error) {
      console.error("[Cyber Forge] 二维码生成失败，档案仍可下载", error);
      setQrUrl("");
      setPosterUrl(await buildPoster(result, ""));
    }
    playCosmicCue("archive", 0.7);
  }, [buildPoster, playCosmicCue, setStageBoth]);

  const resetExperience = useCallback(() => {
    pressureRef.current = 100;
    energyRef.current = 0;
    setPressure(100);
    setEnergy(0);
    setReleaseCount(0);
    setOpenPalmProgress(0);
    setMission(0);
    missionRef.current = 0;
    setCalibrationProgress(0);
    setHandCount(0);
    latestHandsRef.current = [];
    smoothedRef.current = {};
    detectionBusyRef.current = false;
    setDiagnostic("等待手掌重新进入扫描区");
    setArchive(null);
    archiveRef.current = null;
    setPosterUrl("");
    setQrUrl("");
    setShareUrl("");
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl("");
    particlesRef.current = [];
    shockwavesRef.current = [];
    trailsRef.current = [];
    metricsRef.current = { ...INITIAL_METRICS };
    previousPalmsRef.current = {};
    pinchStateRef.current = {};
    compressionActiveRef.current = false;
    portalArmedRef.current = false;
    openPalmStartedRef.current = 0;
    cosmicMatchRef.current = DEFAULT_COSMIC_MATCH;
    setCosmicMatch(DEFAULT_COSMIC_MATCH);
    lastReleaseRef.current = 0;
    if (demoModeRef.current) {
      beginCalibration();
    } else if (hasLiveCameraPipeline({
      status: cameraStatus,
      tracks: cameraStreamRef.current?.getVideoTracks() ?? [],
      runtimeReady: handsRuntimeRef.current !== null,
      loopScheduled: cameraLoopRef.current !== null,
    })) {
      beginCalibration();
    } else {
      setStageBoth("idle");
      setCameraStatus("idle");
      void startCamera();
    }
  }, [beginCalibration, cameraStatus, setStageBoth, startCamera, videoUrl]);

  const updateDemo = useCallback(
    (pose: DemoPose) => {
      demoPoseRef.current = pose;
      setDemoPose(pose);
      if (pose === "open" && stageRef.current === "forging") {
        setTimeout(() => {
          demoPoseRef.current = "open";
          setDemoPose("open");
        }, 420);
      }
    },
    [],
  );

  const missionText = useMemo(() => {
    if (stage === "portal") return t.taskPortal;
    return [
      t.taskPinch,
      t.taskRelease,
      t.taskCompress,
      t.taskExpand,
    ][mission];
  }, [mission, stage, t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("archive");
    if (!encoded) return;
    const result = decodeArchive(encoded);
    if (!result) return;
    archiveRef.current = result;
    queueMicrotask(() => {
      setArchive(result);
      setStageBoth("result");
      const url = window.location.href;
      setShareUrl(url);
      QRCode.toDataURL(url, {
        width: 240,
        margin: 1,
        color: { dark: "#06151d", light: "#f3fbfc" },
        errorCorrectionLevel: "L",
      }).then(async (qr) => {
        setQrUrl(qr);
        setPosterUrl(await buildPoster(result, qr));
      }).catch(async (error) => {
        console.error("[Cyber Forge] 二维码生成失败，档案仍可下载", error);
        setQrUrl("");
        setPosterUrl(await buildPoster(result, ""));
      });
    });
  }, [buildPoster, setStageBoth]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);

  useEffect(() => {
    demoPoseRef.current = demoPose;
  }, [demoPose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") {
        document.documentElement.requestFullscreen?.();
      }
      if (event.key.toLowerCase() === "r") resetExperience();
      if (event.key.toLowerCase() === "d" && stageRef.current === "idle") {
        startDemo();
      }
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetExperience, startDemo]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    let animationFrame = 0;
    let previousTime = performance.now();
    const cosmosImage = new Image();
    cosmosImage.src = publicAsset("/cosmic-nebula.png");
    const stars = Array.from({ length: 420 }, (_, index) => ({
      x: seeded(index * 17.31),
      y: seeded(index * 31.17),
      size: 0.35 + seeded(index * 3.93) * 2.35,
      phase: seeded(index * 11.7) * Math.PI * 2,
      depth: 0.3 + seeded(index * 7.19) * 0.7,
      temperature: seeded(index * 23.71),
    }));

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const addAmbientParticles = (
      width: number,
      height: number,
      count: number,
      hue: number,
    ) => {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 22 + Math.random() * Math.min(width, height) * 0.24;
        particlesRef.current.push({
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius * 0.45,
          vx: Math.cos(angle + Math.PI / 2) * (0.1 + Math.random() * 0.5),
          vy: Math.sin(angle + Math.PI / 2) * (0.1 + Math.random() * 0.5),
          life: 1,
          maxLife: 1.5 + Math.random() * 2.8,
          size: 0.8 + Math.random() * 2.6,
          hue: hue + Math.random() * 45 - 22,
          orbit: angle,
        });
      }
    };

    const getHands = (): HandSignal[] => {
      if (!demoModeRef.current) return latestHandsRef.current;
      const pose = demoPoseRef.current;
      return [
        makeSyntheticHand(
          "demo-right",
          0.5,
          pose === "fist" ? 0.55 : 0.52,
          pose,
        ),
      ];
    };

    const drawGrid = (width: number, height: number, time: number) => {
      context.save();
      context.strokeStyle = "rgba(74, 203, 219, .075)";
      context.lineWidth = 1;
      const horizon = height * 0.67;
      for (let index = -8; index <= 8; index += 1) {
        context.beginPath();
        context.moveTo(width / 2 + index * 18, horizon);
        context.lineTo(width / 2 + index * width * 0.16, height);
        context.stroke();
      }
      for (let row = 0; row < 9; row += 1) {
        const progress = ((row + (time * 0.00012) % 1) / 9) ** 2;
        const y = horizon + progress * (height - horizon);
        context.globalAlpha = 0.3 + progress * 0.7;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();
    };

    const drawCore = (
      width: number,
      height: number,
      time: number,
      currentEnergy: number,
      currentPressure: number,
    ) => {
      const x = width / 2;
      const y = height / 2 + height * 0.03;
      const pulse = 1 + Math.sin(time * 0.003) * 0.055;
      const radius = (30 + currentEnergy * 0.72) * pulse;
      const hue = metricsRef.current.hue;
      const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.8);
      glow.addColorStop(0, `hsla(${hue + 18}, 96%, 84%, .95)`);
      glow.addColorStop(0.16, `hsla(${hue}, 92%, 61%, .62)`);
      glow.addColorStop(0.46, `hsla(${hue + 38}, 92%, 44%, .18)`);
      glow.addColorStop(1, "transparent");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, radius * 2.8, 0, Math.PI * 2);
      context.fill();

      const stellarSurface = context.createRadialGradient(
        x - radius * 0.28,
        y - radius * 0.34,
        radius * 0.04,
        x,
        y,
        radius,
      );
      stellarSurface.addColorStop(0, "rgba(255,255,244,.98)");
      stellarSurface.addColorStop(0.22, `hsla(${hue + 24}, 100%, 79%, .98)`);
      stellarSurface.addColorStop(0.67, `hsla(${hue}, 96%, 48%, .96)`);
      stellarSurface.addColorStop(1, "rgba(3,8,14,.92)");
      context.fillStyle = stellarSurface;
      context.shadowBlur = radius * 0.9;
      context.shadowColor = `hsla(${hue}, 100%, 68%, .72)`;
      context.beginPath();
      context.arc(x, y, radius * 0.72, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;

      context.save();
      context.translate(x, y);
      context.rotate(time * 0.00018);
      for (let ring = 0; ring < 4; ring += 1) {
        context.strokeStyle = `hsla(${hue + ring * 14}, 94%, 74%, ${
          0.18 + currentPressure / 260
        })`;
        context.lineWidth = ring === 0 ? 1.8 : 0.9;
        context.setLineDash([8 + ring * 3, 10 + ring * 4]);
        context.beginPath();
        context.ellipse(
          0,
          0,
          radius * (1.1 + ring * 0.4),
          radius * (0.38 + ring * 0.1),
          ring * 0.64,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.restore();
      context.setLineDash([]);

      context.save();
      context.translate(x, y);
      context.rotate(-time * 0.00034);
      const accretion = context.createLinearGradient(-radius * 2.2, 0, radius * 2.2, 0);
      accretion.addColorStop(0, "transparent");
      accretion.addColorStop(0.25, `hsla(${hue + 35}, 100%, 72%, .08)`);
      accretion.addColorStop(0.5, `hsla(${hue + 12}, 100%, 88%, .78)`);
      accretion.addColorStop(0.75, `hsla(${hue - 10}, 100%, 58%, .1)`);
      accretion.addColorStop(1, "transparent");
      context.strokeStyle = accretion;
      context.lineWidth = Math.max(2, radius * 0.09);
      context.beginPath();
      context.ellipse(0, 0, radius * 1.95, radius * 0.27, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    };

    const drawPortal = (width: number, height: number, time: number) => {
      const elapsed = Math.max(0, time - stageTimerRef.current);
      const progress = clamp(elapsed / 4200, 0, 1);
      const x = width / 2;
      const y = height / 2;
      const maxRadius = Math.hypot(width, height) * 0.42;
      const radius = lerp(24, maxRadius, Math.min(1, progress * 1.35));
      const hue = metricsRef.current.hue;
      context.save();
      context.translate(x, y);
      for (let ray = 0; ray < 72; ray += 1) {
        const angle = (ray / 72) * Math.PI * 2 + time * 0.00022;
        const inner = radius * (0.42 + (ray % 5) * 0.01);
        const outer = radius * (0.82 + seeded(ray * 7.3) * 0.46);
        context.strokeStyle = `hsla(${hue + (ray % 9) * 3}, 96%, 72%, ${0.035 + progress * 0.11})`;
        context.lineWidth = 0.65 + (ray % 4) * 0.18;
        context.beginPath();
        context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.76);
        context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.9);
        context.stroke();
      }
      for (let ring = 0; ring < 16; ring += 1) {
        const ringRadius = radius * (0.35 + ring * 0.052);
        context.rotate((ring % 2 ? -1 : 1) * 0.014);
        context.strokeStyle = `hsla(${hue + ring * 5}, 92%, ${
          52 + ring * 1.5
        }%, ${0.14 + ring * 0.015})`;
        context.lineWidth = 1 + (ring % 4) * 0.7;
        context.setLineDash([12 + ring * 2, 8 + ring]);
        context.lineDashOffset = time * (ring % 2 ? 0.045 : -0.032);
        context.beginPath();
        context.ellipse(
          0,
          0,
          ringRadius,
          ringRadius * (0.7 + progress * 0.28),
          ring * 0.22,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      const voidGradient = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.46);
      voidGradient.addColorStop(0, "rgba(2, 5, 8, .98)");
      voidGradient.addColorStop(0.55, "rgba(5, 21, 31, .92)");
      voidGradient.addColorStop(1, `hsla(${hue}, 90%, 54%, .2)`);
      context.fillStyle = voidGradient;
      context.beginPath();
      context.ellipse(0, 0, radius * 0.48, radius * 0.45, 0, 0, Math.PI * 2);
      context.fill();

      const lens = context.createRadialGradient(0, 0, radius * 0.34, 0, 0, radius * 0.58);
      lens.addColorStop(0, "rgba(0,0,0,0)");
      lens.addColorStop(0.72, `hsla(${hue + 28}, 100%, 82%, .04)`);
      lens.addColorStop(0.9, `hsla(${hue + 8}, 100%, 76%, .68)`);
      lens.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = lens;
      context.beginPath();
      context.arc(0, 0, radius * 0.59, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.setLineDash([]);

      if (progress > 0.72) {
        const whiteout = clamp((progress - 0.72) / 0.28, 0, 1);
        context.fillStyle = `rgba(188, 247, 255, ${whiteout * 0.18})`;
        context.fillRect(0, 0, width, height);
      }
    };

    const drawNode = (
      shape: JointShape,
      x: number,
      y: number,
      radius: number,
      hue: number,
      time: number,
      index: number,
    ) => {
      context.save();
      context.translate(x, y);
      context.rotate(time * 0.0012 + index * 0.37);
      context.fillStyle = `hsla(${hue}, 100%, 78%, .86)`;
      context.strokeStyle = `hsla(${hue + 28}, 100%, 88%, .95)`;
      context.lineWidth = 1;
      context.beginPath();
      if (shape === "diamond") {
        context.moveTo(0, -radius * 1.35);
        context.lineTo(radius, 0);
        context.lineTo(0, radius * 1.35);
        context.lineTo(-radius, 0);
        context.closePath();
      } else if (shape === "triangle") {
        for (let point = 0; point < 3; point += 1) {
          const angle = -Math.PI / 2 + point * (Math.PI * 2 / 3);
          const px = Math.cos(angle) * radius * 1.3;
          const py = Math.sin(angle) * radius * 1.3;
          if (!point) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
      } else if (shape === "hex") {
        for (let point = 0; point < 6; point += 1) {
          const angle = point * Math.PI / 3;
          const px = Math.cos(angle) * radius * 1.15;
          const py = Math.sin(angle) * radius * 1.15;
          if (!point) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
      } else if (shape === "star" || shape === "spark") {
        const points = shape === "star" ? 10 : 8;
        for (let point = 0; point < points; point += 1) {
          const angle = -Math.PI / 2 + point * (Math.PI * 2 / points);
          const scale = point % 2 ? 0.35 : 1.35;
          const px = Math.cos(angle) * radius * scale;
          const py = Math.sin(angle) * radius * scale;
          if (!point) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath();
      } else if (shape === "cross") {
        context.moveTo(-radius * 1.5, 0);
        context.lineTo(radius * 1.5, 0);
        context.moveTo(0, -radius * 1.5);
        context.lineTo(0, radius * 1.5);
      } else {
        context.arc(0, 0, radius * (shape === "ring" ? 1.22 : 1), 0, Math.PI * 2);
      }
      if (shape === "ring" || shape === "cross") context.stroke();
      else context.fill();
      context.restore();
    };

    const drawPalmCosmos = (
      match: PalmCosmicMatch,
      x: number,
      y: number,
      radius: number,
      hue: number,
      time: number,
    ) => {
      context.save();
      context.translate(x, y);
      context.rotate(time * 0.00018 + match.signature.orientation * 0.7);
      const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.7);
      glow.addColorStop(0, `hsla(${hue + 20}, 100%, 86%, .42)`);
      glow.addColorStop(0.28, `hsla(${hue}, 96%, 62%, .22)`);
      glow.addColorStop(1, "transparent");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(0, 0, radius * 1.7, 0, Math.PI * 2);
      context.fill();

      if (match.visual === "spiral" || match.visual === "barred") {
        if (match.visual === "barred") {
          const bar = context.createLinearGradient(-radius, 0, radius, 0);
          bar.addColorStop(0, "transparent");
          bar.addColorStop(0.5, `hsla(${hue + 30}, 100%, 86%, .75)`);
          bar.addColorStop(1, "transparent");
          context.strokeStyle = bar;
          context.lineWidth = Math.max(2, radius * 0.1);
          context.beginPath();
          context.moveTo(-radius, 0);
          context.lineTo(radius, 0);
          context.stroke();
        }
        for (let arm = 0; arm < 4; arm += 1) {
          context.strokeStyle = `hsla(${hue + arm * 13}, 100%, ${70 + arm * 3}%, ${0.22 + arm * 0.055})`;
          context.lineWidth = 1.2 + arm * 0.35;
          context.beginPath();
          for (let step = 0; step < 42; step += 1) {
            const progress = step / 41;
            const angle = arm * Math.PI / 2 + progress * Math.PI * 2.2;
            const r = radius * (0.16 + progress * 0.92);
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r * 0.58;
            if (!step) context.moveTo(px, py); else context.lineTo(px, py);
          }
          context.stroke();
        }
      } else if (match.visual === "ring" || match.visual === "helix") {
        const ringCount = match.visual === "ring" ? 2 : 4;
        for (let ring = 0; ring < ringCount; ring += 1) {
          context.strokeStyle = `hsla(${hue + ring * 22}, 100%, 77%, ${0.58 - ring * 0.09})`;
          context.lineWidth = 1.2 + (ringCount - ring) * 0.7;
          context.beginPath();
          context.ellipse(0, 0, radius * (0.42 + ring * 0.2), radius * (0.3 + ring * 0.16), ring * 0.28, 0, Math.PI * 2);
          context.stroke();
        }
        for (let spoke = 0; spoke < 18; spoke += 1) {
          const angle = spoke * Math.PI * 2 / 18;
          context.strokeStyle = `hsla(${hue + 35}, 100%, 84%, .2)`;
          context.beginPath();
          context.moveTo(Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.16);
          context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.76);
          context.stroke();
        }
      } else if (match.visual === "disk") {
        context.strokeStyle = `hsla(${hue + 28}, 100%, 84%, .72)`;
        context.lineWidth = Math.max(2.5, radius * 0.09);
        context.beginPath();
        context.ellipse(0, 0, radius * 1.1, radius * 0.22, 0, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "rgba(2, 5, 10, .72)";
        context.lineWidth = Math.max(1.2, radius * 0.045);
        context.beginPath();
        context.ellipse(0, 0, radius * 1.05, radius * 0.12, 0, 0, Math.PI * 2);
        context.stroke();
      } else if (match.visual === "pillars" || match.visual === "cliffs") {
        context.rotate(-time * 0.00018 - match.signature.orientation * 0.7);
        const columns = match.visual === "pillars" ? 3 : 6;
        for (let column = 0; column < columns; column += 1) {
          context.strokeStyle = `hsla(${hue + column * 10}, 100%, ${58 + column * 4}%, ${0.22 + column * 0.05})`;
          context.lineWidth = radius * (0.12 + column * 0.012);
          context.beginPath();
          const startX = (column - (columns - 1) / 2) * radius * 0.28;
          context.moveTo(startX, radius * 0.72);
          context.bezierCurveTo(startX - radius * 0.18, radius * 0.2, startX + radius * 0.2, -radius * 0.15, startX, -radius * (0.5 + column * 0.05));
          context.stroke();
        }
      } else {
        for (let filament = 0; filament < 13; filament += 1) {
          const angle = filament * Math.PI * 2 / 13 + time * 0.00025;
          context.strokeStyle = `hsla(${hue + filament * 7}, 100%, 74%, .31)`;
          context.lineWidth = 0.8 + filament % 3;
          context.beginPath();
          context.moveTo(0, 0);
          context.bezierCurveTo(
            Math.cos(angle + 0.7) * radius * 0.48,
            Math.sin(angle + 0.7) * radius * 0.48,
            Math.cos(angle - 0.45) * radius * 0.78,
            Math.sin(angle - 0.45) * radius * 0.78,
            Math.cos(angle) * radius * 1.16,
            Math.sin(angle) * radius * 1.16,
          );
          context.stroke();
        }
      }

      context.fillStyle = `hsla(${hue + 30}, 100%, 92%, .95)`;
      context.shadowBlur = 18;
      context.shadowColor = `hsla(${hue}, 100%, 72%, .9)`;
      context.beginPath();
      context.arc(0, 0, Math.max(2.5, radius * 0.07), 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawHands = (
      hands: HandSignal[],
      width: number,
      height: number,
      time: number,
    ) => {
      hands.forEach((hand, handIndex) => {
        const match = classifyHandCosmos(hand);
        if (handIndex === 0 && hand.isOpen) {
          const changed = cosmicMatchRef.current.id !== match.id;
          cosmicMatchRef.current = match;
          if (changed) setCosmicMatch(match);
        }
        const hue = (metricsRef.current.hue + match.hueShift + handIndex * 36) % 360;
        const palmX = hand.palm.x * width;
        const palmY = hand.palm.y * height;
        const galaxyRadius = clamp(hand.palmWidth * width * 0.86, 38, Math.min(width, height) * 0.19);
        if (hand.isOpen) drawPalmCosmos(match, palmX, palmY, galaxyRadius, hue, time);

        context.save();
        context.lineCap = "round";
        context.shadowBlur = 14;
        context.shadowColor = `hsla(${hue}, 100%, 72%, .72)`;
        context.strokeStyle = `hsla(${hue}, 92%, 76%, ${hand.isOpen ? 0.58 : 0.34})`;
        context.lineWidth = debug ? 2.2 : 1.1;
        CONNECTIONS.forEach(([from, to]) => {
          const a = hand.landmarks[from];
          const b = hand.landmarks[to];
          context.beginPath();
          context.moveTo(a.x * width, a.y * height);
          context.lineTo(b.x * width, b.y * height);
          context.stroke();
        });
        hand.landmarks.forEach((point, pointIndex) => {
          const pulse = 2.2 + Math.sin(time * 0.008 + pointIndex) * 0.7 + match.signature.palmScale * 1.2;
          drawNode(
            pointIndex === 4 || pointIndex === 8 ? "star" : match.nodeShape,
            point.x * width,
            point.y * height,
            pulse,
            pointIndex === 4 || pointIndex === 8 ? hue + 38 : hue,
            time,
            pointIndex,
          );
        });
        context.restore();

        if (hand.isOpen) {
          context.save();
          context.fillStyle = `hsla(${hue + 20}, 100%, 86%, .78)`;
          context.font = "600 10px ui-monospace, SFMono-Regular, monospace";
          context.letterSpacing = "1.5px";
          context.fillText(`${match.catalog} / ${match.nameEn.toUpperCase()}`, palmX + galaxyRadius * 0.72, palmY - galaxyRadius * 0.7);
          context.fillStyle = "rgba(205, 236, 243, .48)";
          context.font = "500 8px ui-monospace, SFMono-Regular, monospace";
          context.fillText(`PALM SCALE ${Math.round(match.signature.palmScale * 100)} · SYMMETRY ${Math.round(match.signature.symmetry * 100)}`, palmX + galaxyRadius * 0.72, palmY - galaxyRadius * 0.7 + 15);
          context.restore();
        }
      });
    };

    const drawDeepSpace = (
      width: number,
      height: number,
      time: number,
      hands: HandSignal[],
    ) => {
      const hue = (metricsRef.current.hue + cosmicMatchRef.current.hueShift) % 360;
      const driftX = hands[0] ? (hands[0].palm.x - 0.5) * 42 : Math.sin(time * 0.00009) * 12;
      const driftY = hands[0] ? (hands[0].palm.y - 0.5) * 28 : Math.cos(time * 0.00007) * 8;
      context.save();
      context.globalCompositeOperation = "screen";

      for (let ribbon = 0; ribbon < 3; ribbon += 1) {
        const y = height * (0.26 + ribbon * 0.2) + Math.sin(time * 0.00022 + ribbon * 1.7) * 34 - driftY * (0.2 + ribbon * 0.15);
        const gradient = context.createLinearGradient(0, y - 90, width, y + 90);
        gradient.addColorStop(0, "transparent");
        gradient.addColorStop(0.28, `hsla(${hue + ribbon * 46}, 90%, 50%, .025)`);
        gradient.addColorStop(0.54, `hsla(${hue + 70 + ribbon * 28}, 100%, 66%, .09)`);
        gradient.addColorStop(0.78, `hsla(${hue - 22 + ribbon * 19}, 96%, 54%, .025)`);
        gradient.addColorStop(1, "transparent");
        context.strokeStyle = gradient;
        context.lineWidth = 44 + ribbon * 23;
        context.beginPath();
        context.moveTo(-80, y + Math.sin(time * 0.0003 + ribbon) * 22);
        context.bezierCurveTo(
          width * 0.28, y - 110 + driftX * 0.2,
          width * 0.66, y + 120 - driftX * 0.25,
          width + 80, y - 20,
        );
        context.stroke();
      }

      const lensX = width * 0.78 - driftX * 0.4;
      const lensY = height * 0.24 - driftY * 0.35;
      context.save();
      context.translate(lensX, lensY);
      context.rotate(time * 0.00008);
      for (let arc = 0; arc < 5; arc += 1) {
        context.strokeStyle = `hsla(${hue + 35 + arc * 12}, 100%, 82%, ${0.045 - arc * 0.005})`;
        context.lineWidth = 0.8 + arc * 0.35;
        context.beginPath();
        context.ellipse(0, 0, 40 + arc * 13, 16 + arc * 5, arc * 0.34, -2.55, 0.35);
        context.stroke();
      }
      context.restore();

      for (let galaxy = 0; galaxy < 9; galaxy += 1) {
        const gx = seeded(galaxy * 41.7) * width - driftX * (0.12 + galaxy * 0.018);
        const gy = seeded(galaxy * 93.1) * height - driftY * (0.08 + galaxy * 0.013);
        const gr = 4 + seeded(galaxy * 13.9) * 9;
        context.save();
        context.translate(gx, gy);
        context.rotate(seeded(galaxy * 3.2) * Math.PI);
        context.strokeStyle = `hsla(${hue + galaxy * 17}, 86%, 78%, .13)`;
        context.lineWidth = 0.65;
        context.beginPath();
        context.ellipse(0, 0, gr * 1.8, gr * 0.42, 0, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = `hsla(${hue + 28}, 100%, 90%, .22)`;
        context.beginPath();
        context.arc(0, 0, 0.8 + gr * 0.08, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      context.restore();
    };

    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const dt = Math.min(0.05, Math.max(0.001, (time - previousTime) / 1000));
      previousTime = time;
      const currentStage = stageRef.current;
      const hands = getHands();
      const shouldUpdateHud = time - lastHudUpdateRef.current > 120;
      if (shouldUpdateHud) {
        setHandCount(hands.length);
        lastHudUpdateRef.current = time;
      }

      const bg = context.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#01040a");
      bg.addColorStop(0.55, "#03080f");
      bg.addColorStop(1, "#000205");
      context.fillStyle = bg;
      context.fillRect(0, 0, width, height);

      if (cosmosImage.complete && cosmosImage.naturalWidth) {
        const imageScale = Math.max(width / cosmosImage.naturalWidth, height / cosmosImage.naturalHeight) * 1.035;
        const drawWidth = cosmosImage.naturalWidth * imageScale;
        const drawHeight = cosmosImage.naturalHeight * imageScale;
        const primaryHand = hands[0];
        const parallaxX = primaryHand ? (primaryHand.palm.x - 0.5) * 24 : Math.sin(time * 0.00008) * 8;
        const parallaxY = primaryHand ? (primaryHand.palm.y - 0.5) * 16 : Math.cos(time * 0.00006) * 5;
        context.save();
        context.globalAlpha = currentStage === "portal" ? 0.38 : 0.72;
        context.filter = "saturate(0.82) contrast(1.12) brightness(0.7)";
        context.drawImage(
          cosmosImage,
          (width - drawWidth) / 2 - parallaxX,
          (height - drawHeight) / 2 - parallaxY,
          drawWidth,
          drawHeight,
        );
        context.restore();
      }

      const pressureLevel = pressureRef.current / 100;
      const nebula = context.createRadialGradient(
        width * 0.52,
        height * 0.48,
        10,
        width * 0.52,
        height * 0.48,
        Math.max(width, height) * 0.62,
      );
      nebula.addColorStop(
        0,
        `hsla(${metricsRef.current.hue}, 82%, 30%, ${
          0.16 * pressureLevel + energyRef.current / 820
        })`,
      );
      nebula.addColorStop(0.46, "rgba(4, 29, 40, .13)");
      nebula.addColorStop(1, "transparent");
      context.fillStyle = nebula;
      context.fillRect(0, 0, width, height);

      drawDeepSpace(width, height, time, hands);

      const handParallaxX = hands[0] ? (hands[0].palm.x - 0.5) * 15 : 0;
      const handParallaxY = hands[0] ? (hands[0].palm.y - 0.5) * 10 : 0;
      stars.forEach((star) => {
        const alpha =
          (0.16 + 0.42 * pressureLevel) *
          (0.62 + Math.sin(time * 0.001 * star.depth + star.phase) * 0.38);
        const starColor = star.temperature < 0.2
          ? `rgba(255, 196, 145, ${alpha})`
          : star.temperature > 0.78
            ? `rgba(171, 213, 255, ${alpha})`
            : `rgba(244, 246, 255, ${alpha})`;
        const starX = star.x * width - handParallaxX * star.depth;
        const starY = star.y * height - handParallaxY * star.depth;
        context.fillStyle = starColor;
        context.beginPath();
        context.arc(starX, starY, star.size * star.depth, 0, Math.PI * 2);
        context.fill();
        if (star.size > 2.25) {
          context.strokeStyle = starColor;
          context.lineWidth = 0.45;
          context.beginPath();
          context.moveTo(starX - star.size * 3.5, starY);
          context.lineTo(starX + star.size * 3.5, starY);
          context.moveTo(starX, starY - star.size * 3.5);
          context.lineTo(starX, starY + star.size * 3.5);
          context.stroke();
        }
      });
      if (currentStage === "calibrating" || debug) drawGrid(width, height, time);

      if (currentStage === "calibrating") {
        if (!hands.length) calibrationStartedRef.current = time;
        const elapsed = time - calibrationStartedRef.current;
        const progress = hands.length ? clamp(elapsed / 5000, 0, 1) : 0;
        if (shouldUpdateHud) {
          setCalibrationProgress(progress);
        }
        if (progress >= 1) {
          metricsRef.current = {
            ...INITIAL_METRICS,
            startedAt: time,
            hue: 188 + Math.random() * 42,
          };
          pressureRef.current = 100;
          energyRef.current = 8;
          setPressure(100);
          setEnergy(8);
          setStageBoth("forging");
          playCosmicCue("wake", 0.66);
        }
      }

      if (currentStage === "forging") {
        const active = hands.length > 0;
        if (active) {
          let frameMovement = 0;
          hands.forEach((hand) => {
            const previous = previousPalmsRef.current[hand.id];
            if (previous) {
              frameMovement +=
                distance(previous, hand.palm) /
                Math.max(hand.palmWidth, 0.02);
            }
            previousPalmsRef.current[hand.id] = { ...hand.palm };
            trailsRef.current.push({
              x: hand.index.x * width,
              y: hand.index.y * height,
              life: 1,
              hue: metricsRef.current.hue + (hand.label === "Right" ? 28 : 0),
            });

            const pinch =
              pinchStateRef.current[hand.id] ??
              { pinched: false, enter: 0, release: 0 };
            if (!pinch.pinched && hand.pinchRatio < GESTURE_CONFIG.pinchEnter) {
              pinch.enter += 1;
              pinch.release = 0;
              if (pinch.enter >= GESTURE_CONFIG.confirmFrames) {
                pinch.pinched = true;
                pinch.enter = 0;
                portalArmedRef.current = false;
                openPalmStartedRef.current = 0;
                setOpenPalmProgress(0);
                energyRef.current = clamp(energyRef.current + 4, 0, 100);
                missionRef.current = Math.max(missionRef.current, 1);
                setMission(missionRef.current);
                const pinchX = ((hand.thumb.x + hand.index.x) / 2) * width;
                const pinchY = ((hand.thumb.y + hand.index.y) / 2) * height;
                spawnBurst(pinchX, pinchY, metricsRef.current.hue + 24, 0.62);
                playCosmicCue("pinch", 0.7);
              }
            } else if (
              pinch.pinched &&
              hand.pinchRatio > GESTURE_CONFIG.pinchRelease
            ) {
              pinch.release += 1;
              pinch.enter = 0;
              if (
                pinch.release >= GESTURE_CONFIG.confirmFrames &&
                time - lastReleaseRef.current > 380
              ) {
                pinch.pinched = false;
                pinch.release = 0;
                lastReleaseRef.current = time;
                metricsRef.current.releases += 1;
                setReleaseCount(metricsRef.current.releases);
                metricsRef.current.hue =
                  (metricsRef.current.hue + 17 + frameMovement * 4) % 360;
                energyRef.current = clamp(energyRef.current + 12, 0, 100);
                pressureRef.current = clamp(pressureRef.current - 2.7, 0, 100);
                const burstX = ((hand.thumb.x + hand.index.x) / 2) * width;
                const burstY = ((hand.thumb.y + hand.index.y) / 2) * height;
                spawnBurst(burstX, burstY, metricsRef.current.hue, 1.35);
                portalArmedRef.current = true;
                openPalmStartedRef.current = 0;
                missionRef.current = Math.max(missionRef.current, 2);
                setMission(missionRef.current);
                playCosmicCue("release", 0.82);
              }
            } else {
              pinch.enter = 0;
              pinch.release = 0;
            }
            pinchStateRef.current[hand.id] = pinch;

            if (pinch.pinched) {
              compressionActiveRef.current = true;
              metricsRef.current.compression += dt;
              energyRef.current = clamp(energyRef.current + dt * 7.5, 0, 100);
              pressureRef.current = clamp(pressureRef.current - dt * 0.6, 0, 100);
            } else {
              compressionActiveRef.current = false;
            }

            if (portalArmedRef.current && hand.isOpen) {
              if (!openPalmStartedRef.current) openPalmStartedRef.current = time;
              const heldFor = time - openPalmStartedRef.current;
              const holdProgress = clamp(heldFor / GESTURE_CONFIG.openPalmHoldMs, 0, 1);
              metricsRef.current.expansion += dt;
              energyRef.current = clamp(energyRef.current + dt * 5, 0, 100);
              if (shouldUpdateHud) setOpenPalmProgress(holdProgress);
              if (heldFor >= GESTURE_CONFIG.openPalmHoldMs) {
                portalArmedRef.current = false;
                openPalmStartedRef.current = 0;
                setOpenPalmProgress(1);
                spawnBurst(hand.palm.x * width, hand.palm.y * height, metricsRef.current.hue + 36, 2.15);
                playCosmicCue("portal", 0.88);
                openPortal();
              }
            } else {
              openPalmStartedRef.current = 0;
              if (portalArmedRef.current && shouldUpdateHud) setOpenPalmProgress(0);
            }
            if (hand.isPointing && Math.random() < dt * 32 * density) {
              const point = hand.index;
              particlesRef.current.push({
                x: point.x * width,
                y: point.y * height,
                vx: (point.x - 0.5) * 2.6,
                vy: (point.y - 0.5) * 2.6,
                life: 1,
                maxLife: 1.4,
                size: 2.5 + Math.random() * 2,
                hue: metricsRef.current.hue + 55,
                orbit: Math.random() * Math.PI * 2,
              });
            }
          });

          metricsRef.current.movement += frameMovement;
          metricsRef.current.activeFrames += 1;
          if (frameMovement < 0.055 * hands.length) {
            metricsRef.current.calmFrames += 1;
          }
          const drain =
            dt * (0.42 + Math.min(frameMovement * 1.7, 2.4));
          pressureRef.current = clamp(pressureRef.current - drain, 0, 100);
          metricsRef.current.maxCharge = Math.max(
            metricsRef.current.maxCharge,
            energyRef.current,
          );
        } else if (portalArmedRef.current) {
          openPalmStartedRef.current = 0;
          if (shouldUpdateHud) setOpenPalmProgress(0);
        }

        if (Math.random() < dt * (4 + energyRef.current * 0.12) * density) {
          addAmbientParticles(width, height, 1, metricsRef.current.hue);
        }
        if (pressureRef.current <= 0.4) openPortal();

        if (shouldUpdateHud) {
          setPressure(Math.round(pressureRef.current));
          setEnergy(Math.round(energyRef.current));
        }
      }

      const currentEnergy = energyRef.current;
      if (currentStage === "forging" || currentStage === "calibrating") {
        drawCore(width, height, time, currentEnergy, pressureRef.current);
      }

      const coreX = width / 2;
      const coreY = height / 2 + height * 0.03;
      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.maxLife -= dt;
        particle.life = clamp(particle.maxLife / 1.8, 0, 1);
        const dx = coreX - particle.x;
        const dy = coreY - particle.y;
        const d = Math.max(30, Math.hypot(dx, dy));
        const compression = compressionActiveRef.current && currentStage === "forging";
        if (compression) {
          particle.vx += (dx / d) * dt * 14;
          particle.vy += (dy / d) * dt * 14;
        } else {
          particle.vx += (-dy / d) * dt * 0.48;
          particle.vy += (dx / d) * dt * 0.48;
        }
        particle.x += particle.vx * 36 * dt;
        particle.y += particle.vy * 36 * dt;
        particle.vx *= 0.992;
        particle.vy *= 0.992;
        const alpha = clamp(particle.life, 0, 1);
        context.fillStyle = `hsla(${particle.hue}, 92%, 70%, ${alpha * 0.84})`;
        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.size * (0.45 + alpha),
          0,
          Math.PI * 2,
        );
        context.fill();
        return particle.maxLife > 0 && particlesRef.current.length < 1700;
      });

      trailsRef.current = trailsRef.current
        .slice(-220)
        .filter((trail) => {
          trail.life -= dt * 1.65;
          context.fillStyle = `hsla(${trail.hue}, 95%, 72%, ${
            Math.max(0, trail.life) * 0.36
          })`;
          context.beginPath();
          context.arc(trail.x, trail.y, 2 + trail.life * 4, 0, Math.PI * 2);
          context.fill();
          return trail.life > 0;
        });

      shockwavesRef.current = shockwavesRef.current.filter((wave) => {
        wave.life -= dt * 0.86;
        wave.radius += dt * 260;
        context.strokeStyle = `hsla(${wave.hue}, 100%, 76%, ${
          Math.max(0, wave.life) * 0.62
        })`;
        context.lineWidth = 1 + wave.life * 4;
        context.beginPath();
        context.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        context.stroke();
        return wave.life > 0;
      });

      if (
        hands.length &&
        (handTestRef.current || currentStage === "calibrating" || currentStage === "forging")
      ) {
        drawHands(hands, width, height, time);
      }
      if (currentStage === "portal") {
        drawPortal(width, height, time);
        if (time - stageTimerRef.current > 5200) {
          finishExperience();
        }
      }
      if (currentStage === "result" && archiveRef.current) {
        const result = archiveRef.current;
        const glow = context.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.min(width, height) * 0.52,
        );
        glow.addColorStop(0, `hsla(${result.hue}, 90%, 58%, .22)`);
        glow.addColorStop(0.32, `hsla(${result.hue + 32}, 80%, 32%, .12)`);
        glow.addColorStop(1, "transparent");
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }

      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [
    debug,
    density,
    finishExperience,
    openPortal,
    playCosmicCue,
    playTone,
    setStageBoth,
    spawnBurst,
  ]);

  const handStatus =
    handCount >= 1 ? t.oneHand : t.noHands;

  const downloadPoster = () => {
    if (!posterUrl || !archive) return;
    const anchor = document.createElement("a");
    anchor.href = posterUrl;
    anchor.download = `${archive.name.replace(/[^\w\u4e00-\u9fa5-]+/g, "_")}.png`;
    anchor.click();
  };

  const downloadVideo = async () => {
    if (!videoUrl || !archive) return;
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    downloadBlob(blob, `${archive.name}-star-gate.webm`);
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className={`forge-shell stage-${stage} ${handTest ? "hand-test-mode" : ""}`}>
      <canvas ref={canvasRef} className="forge-canvas" aria-hidden="true" />
      <video ref={videoRef} className="tracking-video" muted playsInline />
      <div className="film-grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <header className="top-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div>
            <span className="brand-name">{t.product}</span>
            <span className="brand-sub">CYBER FOUNDATION · EXPERIMENT 01</span>
          </div>
        </div>
        <div className="top-actions">
          <button
            className="language-toggle"
            onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
            aria-label="Switch language"
          >
            <span className={language === "zh" ? "active" : ""}>中</span>
            <span className={language === "en" ? "active" : ""}>EN</span>
          </button>
          <button
            className={`icon-button ${settingsOpen ? "active" : ""}`}
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label={t.settings}
            aria-expanded={settingsOpen}
          >
            <span className="control-glyph" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>

      {stage === "idle" && (
        <section className="idle-panel" aria-labelledby="forge-title">
          <div className="eyebrow">
            <span className="signal-dot" />
            CLOSED UNIVERSE / ΔP 100.00
          </div>
          <h1 id="forge-title">{t.forge}</h1>
          <p className="thesis">{t.line1}</p>
          <p className="instruction">{t.line2}</p>
          <div className="idle-actions">
            <button
              className="primary-button"
              onClick={startCamera}
              disabled={cameraStatus === "loading"}
            >
              <span className="button-scan" aria-hidden="true" />
              {cameraStatus === "loading" ? t.cameraLoading : t.start}
            </button>
            <button className="text-button" onClick={startDemo}>
              {t.demo}
              <span aria-hidden="true">↗</span>
            </button>
            <button className="text-button" onClick={startHandTest} disabled={cameraStatus === "loading"}>
              {t.handTest}
              <span aria-hidden="true">◎</span>
            </button>
          </div>
          <p className="privacy-note">
            <span className="privacy-icon" aria-hidden="true" />
            {t.privacy}
          </p>
          {(cameraStatus === "denied" || cameraStatus === "unsupported") && (
            <p className="error-note" role="status">
              {cameraStatus === "denied" ? t.cameraDenied : t.modelError}
              <small>{diagnostic}</small>
            </p>
          )}
        </section>
      )}

      {handTest && (
        <section className="hand-test-panel" aria-live="polite">
          <strong>MEDIAPIPE TEST / 21 LANDMARKS</strong>
          <span>{cameraStatus === "loading" ? t.cameraLoading : diagnostic}</span>
          <small>本地MediaPipe · 捏合≤{GESTURE_CONFIG.pinchEnter} · 松开≥{GESTURE_CONFIG.pinchRelease} · 张掌连续2秒开启星门</small>
          <button className="outline-button" onClick={() => { handTestRef.current = false; setHandTest(false); stopCamera(); setCameraStatus("idle"); }}>
            {t.handTestExit}
          </button>
        </section>
      )}

      {stage === "calibrating" && (
        <section className="calibration-overlay" aria-live="polite">
          <div className="scan-frame" aria-hidden="true">
            <span className="corner c1" />
            <span className="corner c2" />
            <span className="corner c3" />
            <span className="corner c4" />
            <span className="scan-line" />
          </div>
          <div className="calibration-copy">
            <span className="status-kicker">{t.scanning}</span>
            <h2>{t.calibration}</h2>
            <p>{t.calibrationHint}</p>
            <div className="calibration-progress">
              <span style={{ width: `${calibrationProgress * 100}%` }} />
            </div>
            <div className="calibration-data">
              <span>PALM SCALE</span>
              <strong>{Math.round(calibrationProgress * 100)}%</strong>
              <span>RANGE MAP</span>
              <strong>{handCount ? "LOCKED" : "SEARCHING"}</strong>
            </div>
          </div>
        </section>
      )}

      {(stage === "forging" || stage === "portal") && (
        <>
          <aside className="telemetry telemetry-left" aria-label="Telemetry">
            <div className="telemetry-label">
              <span>{t.pressure}</span>
              <em>ΔP</em>
            </div>
            <strong className="pressure-value">
              {stage === "portal" ? "00" : String(pressure).padStart(2, "0")}
              <small>%</small>
            </strong>
            <div className="vertical-meter">
              <span style={{ height: `${pressure}%` }} />
            </div>
            <dl>
              <div>
                <dt>P.HIGH</dt>
                <dd>{(1.88 + pressure / 100).toFixed(2)}</dd>
              </div>
              <div>
                <dt>P.LOW</dt>
                <dd>{(1.88 - pressure / 190).toFixed(2)}</dd>
              </div>
              <div>
                <dt>{t.entropy}</dt>
                <dd>{String(100 - pressure).padStart(2, "0")}</dd>
              </div>
            </dl>
          </aside>

          <aside className="telemetry telemetry-right">
            <div className="telemetry-label">
              <span>{t.energy}</span>
              <em>CORE</em>
            </div>
            <strong className="energy-value">{String(energy).padStart(2, "0")}</strong>
            <div className="radial-mini" style={{ "--energy": `${energy * 3.6}deg` } as React.CSSProperties}>
              <span />
            </div>
            <dl>
              <div>
                <dt>{t.handSignal}</dt>
                <dd>{handCount}/1</dd>
              </div>
              <div>
                <dt>THOUGHT PULSE</dt>
                <dd>{releaseCount}</dd>
              </div>
            </dl>
          </aside>

          <section className="mission-card" aria-live="polite">
            <span className="mission-index">
              {stage === "portal" ? "05" : `0${mission + 1}`}
            </span>
            <div>
              <small>{stage === "portal" ? t.portal : t.forging}</small>
              <p>{missionText}</p>
              {stage === "forging" && mission >= 2 && (
                <div className="palm-hold-meter" aria-label={`Open palm hold ${Math.round(openPalmProgress * 100)}%`}>
                  <span style={{ width: `${openPalmProgress * 100}%` }} />
                  <em>{Math.round(openPalmProgress * 2)} / 2 SEC</em>
                </div>
              )}
            </div>
            <div className={`gesture-symbol gesture-${stage === "portal" ? "portal" : mission}`} aria-hidden="true">
              <span />
              <span />
            </div>
          </section>

          <div className={`hand-status hands-${handCount}`}>
            <span className="signal-bars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {handStatus}
          </div>

          {stage === "forging" && handCount > 0 && (
            <div className="cosmic-match-hud" aria-live="polite">
              <span>PALM / CELESTIAL MATCH</span>
              <strong>{cosmicMatch.catalog} · {cosmicMatch.nameZh}</strong>
              <small>{cosmicMatch.objectType}</small>
              <div>
                <i style={{ width: `${cosmicMatch.signature.palmScale * 100}%` }} />
              </div>
            </div>
          )}

        </>
      )}

      {stage === "portal" && (
        <div className="portal-copy" aria-live="assertive">
          <span>APERTURE / 01</span>
          <h2>{t.portal}</h2>
          <p>ΔP → 0.00 · ARCHIVING THOUGHT PATTERN</p>
        </div>
      )}

      {stage === "result" && archive && (
        <section className="result-layout">
          <div className="result-copy">
            <span className="result-kicker">ARCHIVE COMPLETE / {archive.generationId || archive.seed}</span>
            <h1>{archive.name}</h1>
            <p className="result-identity">{archive.identity}</p>
            <blockquote className="generated-poem">
              <small>GENERATIVE VERSE / 本地生成式诗句</small>
              {(archive.poem ?? [archive.inscription]).map((line) => <span key={line}>{line}</span>)}
            </blockquote>
            {archive.realObject && (
              <section className="cosmic-report" aria-label="现实天体映射报告">
                <div className="cosmic-report-heading">
                  <span>REAL CELESTIAL ANALOGUE</span>
                  <em>{archive.realCatalog}</em>
                </div>
                <h2>{archive.realObject}</h2>
                <p className="object-type">{archive.objectType}</p>
                <p>{archive.narrative}</p>
                <div className="signature-grid">
                  <span>掌面尺度 <b>{Math.round(archive.palmSignature.palmScale * 100)}</b></span>
                  <span>指尖展开 <b>{Math.round(archive.palmSignature.fingerSpan * 100)}</b></span>
                  <span>星图对称 <b>{Math.round(archive.palmSignature.symmetry * 100)}</b></span>
                </div>
                <div className="inspiration-tags">
                  {archive.inspiration.map((item) => <span key={item}>{item}</span>)}
                </div>
              </section>
            )}
            <dl className="result-stats">
              <div>
                <dt>{t.pattern}</dt>
                <dd>{archive.pattern}</dd>
              </div>
              <div>
                <dt>{t.lifetime}</dt>
                <dd>{archive.duration}s</dd>
              </div>
              <div>
                <dt>{t.consumed}</dt>
                <dd>{archive.pressureUsed}%</dd>
              </div>
              <div>
                <dt>{t.calm}</dt>
                <dd>{archive.calm}%</dd>
              </div>
            </dl>
            <div className="result-actions">
              <button className="primary-button compact" onClick={downloadPoster} disabled={!posterUrl}>
                {t.downloadPoster}
              </button>
              <button className="outline-button" onClick={downloadVideo} disabled={!videoUrl}>
                {t.downloadVideo}
              </button>
              <button className="outline-button" onClick={copyShareLink}>
                {copied ? t.copied : t.copyLink}
              </button>
              <button className="text-button restart" onClick={resetExperience}>
                {t.again} <span aria-hidden="true">↻</span>
              </button>
            </div>
          </div>
          <div className="archive-card">
            <div className="archive-card-header">
              <span>{t.archive}</span>
              <em>NO. {archive.generationId || String(archive.seed % 10000).padStart(4, "0")}</em>
            </div>
            {posterUrl ? (
              <img src={posterUrl} alt={`${archive.name} ${t.archive}`} />
            ) : (
              <div className="poster-loading">
                <span />
                ARCHIVING…
              </div>
            )}
            <div className="qr-row">
              {qrUrl && <img src={qrUrl} alt="Share QR code" />}
              <p>{t.shareHint}</p>
            </div>
          </div>
        </section>
      )}

      {demoMode && stage !== "idle" && stage !== "result" && (
        <nav className="demo-dock" aria-label={t.demoControl}>
          <span>{t.demoControl}</span>
          <button
            className={demoPose === "pinch" ? "active" : ""}
            onClick={() => updateDemo("pinch")}
          >
            {t.pinch}
          </button>
          <button onClick={() => updateDemo("open")}>{t.release}</button>
          <small>张开后保持2秒自动开启星门</small>
        </nav>
      )}

      <aside className={`settings-panel ${settingsOpen ? "open" : ""}`}>
        <div className="settings-heading">
          <div>
            <span>SYS / CONFIG</span>
            <h2>{t.settings}</h2>
          </div>
          <button onClick={() => setSettingsOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
        <label className="setting-row">
          <span>
            {t.sound}
            <small>LOW-FREQUENCY FEEDBACK</small>
          </span>
          <input
            type="checkbox"
            checked={soundOn}
            onChange={(event) => setSoundOn(event.target.checked)}
          />
        </label>
        <label className="setting-row">
          <span>
            {t.debug}
            <small>21-POINT LANDMARK MAP</small>
          </span>
          <input
            type="checkbox"
            checked={debug}
            onChange={(event) => setDebug(event.target.checked)}
          />
        </label>
        <label className="setting-slider">
          <span>
            {t.density}
            <strong>{Math.round(density * 100)}%</strong>
          </span>
          <input
            type="range"
            min="0.45"
            max="1.45"
            step="0.05"
            value={density}
            onChange={(event) => setDensity(Number(event.target.value))}
          />
        </label>
        <button
          className="settings-action"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          {t.fullscreen} <kbd>F</kbd>
        </button>
        <button className="settings-action" onClick={resetExperience}>
          {t.reset} <kbd>R</kbd>
        </button>
        <div className="privacy-panel">
          <span className="privacy-icon" aria-hidden="true" />
          <p>{t.privacy}</p>
        </div>
      </aside>

      <footer className="bottom-meta">
        <span>PRESSURE-DRIVEN CLOSED UNIVERSE</span>
        <span className="coordinates">22.3364° N / 114.2655° E</span>
        <span>LOCAL PROCESSING / NO RAW VIDEO</span>
      </footer>
    </main>
  );
}
