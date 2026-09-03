import { distance, type HandSignal } from "./gesture-engine.ts";

export type JointShape =
  | "orb"
  | "diamond"
  | "ring"
  | "hex"
  | "star"
  | "cross"
  | "triangle"
  | "spark";

export type CosmicVisual =
  | "spiral"
  | "barred"
  | "ring"
  | "disk"
  | "helix"
  | "pillars"
  | "cliffs"
  | "filaments";

export type PalmSignature = {
  palmScale: number;
  fingerSpan: number;
  symmetry: number;
  aspect: number;
  openness: number;
  orientation: number;
};

export type PalmCosmicMatch = {
  id: string;
  nameZh: string;
  nameEn: string;
  catalog: string;
  objectType: string;
  feature: string;
  nodeShape: JointShape;
  visual: CosmicVisual;
  hueShift: number;
  signature: PalmSignature;
  matchReason: string;
};

export type GeneratedCosmicNarrative = {
  nebulaName: string;
  generationId: string;
  poem: [string, string, string];
  identity: string;
  pattern: string;
  narrative: string;
  inspiration: string[];
};

type ProfileDefinition = Omit<PalmCosmicMatch, "signature" | "matchReason">;

const PROFILES: Record<string, ProfileDefinition> = {
  andromeda: {
    id: "andromeda",
    nameZh: "仙女座星系",
    nameEn: "Andromeda Galaxy",
    catalog: "M31",
    objectType: "成熟棒旋星系",
    feature: "蓝色年轻星团沿旋臂生长，暗尘带缠绕明亮核心，是银河系最近的大型星系邻居。",
    nodeShape: "star",
    visual: "barred",
    hueShift: 18,
  },
  whirlpool: {
    id: "whirlpool",
    nameZh: "涡状星系",
    nameEn: "Whirlpool Galaxy",
    catalog: "M51",
    objectType: "宏伟设计旋涡星系",
    feature: "弯曲旋臂清晰展开，粉色恒星形成区与蓝色年轻星团交织成有秩序的涡旋。",
    nodeShape: "orb",
    visual: "spiral",
    hueShift: 0,
  },
  cartwheel: {
    id: "cartwheel",
    nameZh: "车轮星系",
    nameEn: "Cartwheel Galaxy",
    catalog: "ESO 350-40",
    objectType: "碰撞环星系",
    feature: "高速星系碰撞留下明暗双环，两道环如冲击波向外扩张，并点燃新的恒星诞生。",
    nodeShape: "ring",
    visual: "ring",
    hueShift: 42,
  },
  sombrero: {
    id: "sombrero",
    nameZh: "草帽星系",
    nameEn: "Sombrero Galaxy",
    catalog: "M104",
    objectType: "近侧视旋涡星系",
    feature: "巨大的恒星核球被深色尘埃盘切开，古老星光在薄盘上下形成冷峻而宽阔的光晕。",
    nodeShape: "diamond",
    visual: "disk",
    hueShift: 64,
  },
  helix: {
    id: "helix",
    nameZh: "螺旋星云",
    nameEn: "Helix Nebula",
    catalog: "NGC 7293",
    objectType: "行星状星云",
    feature: "垂死类太阳恒星抛出的气体形成红蓝光环，细密辐条像一枚凝视时间的宇宙之眼。",
    nodeShape: "hex",
    visual: "helix",
    hueShift: 112,
  },
  pillars: {
    id: "pillars",
    nameZh: "创生之柱",
    nameEn: "Pillars of Creation",
    catalog: "M16 / Eagle Nebula",
    objectType: "恒星形成区",
    feature: "冷气体与尘埃构成高耸柱体，新生恒星在半透明云层深处形成，并逐渐冲破孕育它们的物质。",
    nodeShape: "triangle",
    visual: "pillars",
    hueShift: 148,
  },
  carina: {
    id: "carina",
    nameZh: "船底座宇宙悬崖",
    nameEn: "Carina Cosmic Cliffs",
    catalog: "NGC 3324",
    objectType: "恒星育婴室边缘",
    feature: "年轻炽热恒星的紫外辐射与恒星风雕刻出气体峭壁，红外视野揭开尘埃后的原恒星喷流。",
    nodeShape: "cross",
    visual: "cliffs",
    hueShift: 196,
  },
  tarantula: {
    id: "tarantula",
    nameZh: "蜘蛛星云",
    nameEn: "Tarantula Nebula",
    catalog: "30 Doradus",
    objectType: "巨型恒星形成区",
    feature: "本星系群中最大最明亮的恒星形成区之一，炽热大质量恒星在丝状尘埃和空腔间爆发。",
    nodeShape: "spark",
    visual: "filaments",
    hueShift: 238,
  },
};

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function variance(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length, 1);
}

export function derivePalmSignature(hand: HandSignal): PalmSignature {
  const tips = [4, 8, 12, 16, 20].map((index) => hand.landmarks[index]);
  const radii = tips.map((point) => distance(point, hand.palm) / hand.palmWidth);
  const xs = hand.landmarks.map((point) => point.x);
  const ys = hand.landmarks.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const meanRadius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  const radialVariance = variance(radii) / Math.max(meanRadius ** 2, 0.001);

  return {
    palmScale: clamp((hand.palmWidth - 0.055) / 0.13),
    fingerSpan: clamp(distance(tips[0], tips[4]) / hand.palmWidth / 3.2),
    symmetry: clamp(1 - radialVariance * 3.1),
    aspect: clamp(width / Math.max(height, 0.015) / 1.15),
    openness: hand.openness,
    orientation: clamp(Math.abs(Math.cos(hand.angle))),
  };
}

export function matchCosmicProfile(signature: PalmSignature): PalmCosmicMatch {
  let id = "tarantula";
  let reason = "关节点呈不对称丝状展开，接近大质量恒星育婴室的尘埃纤维。";

  if (signature.palmScale >= 0.7 && signature.fingerSpan >= 0.42) {
    id = "andromeda";
    reason = "较大的掌面与宽阔指距形成成熟大旋涡的尺度感，对应仙女座的广延星盘。";
  } else if (signature.fingerSpan >= 0.67 && signature.symmetry >= 0.58) {
    id = "cartwheel";
    reason = "五指呈近径向对称展开，像碰撞后向外传播的双重星环。";
  } else if (signature.aspect >= 0.73 && signature.orientation >= 0.58) {
    id = "sombrero";
    reason = "关节点投影形成横向薄盘与中央凸起，接近草帽星系的侧视尘埃盘。";
  } else if (signature.symmetry >= 0.78 && signature.fingerSpan < 0.58) {
    id = "helix";
    reason = "指尖半径接近且围绕掌心分布，构成螺旋星云般的环形辐条。";
  } else if (signature.palmScale <= 0.26) {
    id = "pillars";
    reason = "较小掌面让修长指骨如尘埃柱升起，对应创生之柱内部隐秘的恒星胚胎。";
  } else if (signature.orientation < 0.36 || signature.symmetry < 0.45) {
    id = "carina";
    reason = "倾斜而起伏的关节点边界像被恒星风雕刻的船底座宇宙悬崖。";
  } else if (signature.fingerSpan >= 0.5) {
    id = "whirlpool";
    reason = "张开的指骨从掌心向外弯曲，形成涡状星系清晰而连续的旋臂。";
  }

  return { ...PROFILES[id], signature, matchReason: reason };
}

export function classifyHandCosmos(hand: HandSignal) {
  return matchCosmicProfile(derivePalmSignature(hand));
}

function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(items: readonly T[], seed: number, offset: number) {
  return items[Math.floor(seeded(seed + offset) * items.length) % items.length];
}

const NAME_ORIGINS = [
  "天问", "鲲鹏", "烛龙", "若木", "玄圃", "扶桑", "归墟", "星槎",
  "索拉", "海伯", "欧米伽", "阿卡迪亚", "安德罗", "泰坦", "赛博", "盖娅",
  "月海", "黑碑", "远岸", "群星", "环界", "静默", "矩阵", "深时",
] as const;

const NAME_FORMS = [
  "余烬", "回声", "梦潮", "光庭", "星冢", "银脊", "夜航", "晶雨",
  "离歌", "脉冲", "尘塔", "霜环", "量子花", "引力茧", "时间井", "航标",
  "折跃门", "黎明线", "暗物质诗篇", "记忆海", "灵子风", "熵之冠", "永夜枝", "观测者之眼",
] as const;

const NAME_TITLES = ["星云", "星系", "天穹", "航域", "云庭", "深空带", "文明遗迹", "光年群岛"] as const;

const POEM_OPENERS = [
  "当第三次日落沉入无声轨道", "在时间机器尚未锈蚀的黎明", "当月海把银色潮汐交给真空",
  "在仿生梦穿过霓虹雨的夜晚", "当远古黑碑再次听见心跳", "在沙海帝国熄灭最后一盏预言",
  "当群星把历史折叠成一枚光子", "在环形世界缓慢转向晨昏线", "当太阳帆掠过文明的灰烬",
  "在异星海洋保存人类记忆的时刻", "当机械黎明越过火星运河", "在星际信标沉默两万年之后",
] as const;

const POEM_SUBJECTS = [
  "你的掌纹", "五枚指尖的微光", "被压差唤醒的尘埃", "一颗尚未命名的恒星",
  "漂流在算法中的梦", "最后一束人造月光", "远航者遗失的坐标", "沉睡于星云的语言",
] as const;

const POEM_VERBS = ["写下", "折叠", "点燃", "穿透", "重新编译", "悄悄托起", "逆转", "译出"] as const;
const POEM_IMAGES = [
  "一条通往远岸的蓝色旋臂", "比王朝更长久的恒星风", "一座由暗物质构成的花园",
  "尚未发生的银河黎明", "沿时间井盘旋的银色鲸群", "一封寄往宇宙尽头的无字电报",
  "被黑洞保存的第一场雪", "从创生之柱醒来的金色群岛",
] as const;

const POEM_GESTURES = ["张掌", "指尖", "掌心引力", "关节点星图", "一次松开", "两秒钟的静止"] as const;
const POEM_SPACES = ["折跃航道", "静默宇宙", "赛博月海", "群星档案馆", "量子风暴", "无边的星际尘埃"] as const;
const POEM_LIMITS = ["有限的呼吸", "即将平衡的压差", "无法归还的时间", "孤独的观测", "短暂的人类尺度", "熵的阴影"] as const;
const POEM_COSMOS = ["发光的航线", "恒星的母语", "新文明的晨钟", "一场缓慢爆发的春天", "不会消失的坐标", "穿越黑暗的金色语法"] as const;
const POEM_CLOSINGS = [
  "请不要替宇宙回答", "让星门在身后保持微明", "把名字留给下一位远航者",
  "请在万物平衡之前继续凝望", "让所有失落文明共享这一秒", "把沉默也视作一种光",
] as const;
const POEM_MEMORIES = ["你的思想形状", "这次短暂的张掌", "被点亮的尘埃", "未发送的讯息", "掌心的微型银河", "远岸的回声"] as const;
const POEM_FUTURES = ["下一次宇宙中发芽", "黑暗深处保持潮汐", "光锥之外缓慢航行", "陌生恒星旁等待译码", "熵增的尽头继续闪烁", "时间尚未抵达之处呼吸"] as const;

const INSPIRATION_BANK = [
  "东方天问与鲲鹏远航", "月球旅行与时间机器", "火星年代与异星海洋", "仿生梦境与霓虹城市",
  "深空黑碑与静默信号", "沙海文明与预言风暴", "基地史诗与银河编年", "环形世界与星际航道",
  "太阳帆与宇宙孤岛", "意识上传与机械黎明", "折跃航线与远古遗迹", "星海游戏与文明存档",
] as const;

export function generateCosmicNarrative(
  seed: number,
  match: PalmCosmicMatch,
  calm: number,
  releases: number,
): GeneratedCosmicNarrative {
  const name = `${pick(NAME_ORIGINS, seed, 1)}·${pick(NAME_FORMS, seed, 7)}${pick(NAME_TITLES, seed, 13)}`;
  const code = Math.abs(Math.floor(seed * 2654435761)).toString(36).toUpperCase().slice(-7).padStart(7, "0");
  const poem: [string, string, string] = [
    `${pick(POEM_OPENERS, seed, 17)}，${pick(POEM_SUBJECTS, seed, 19)}${pick(POEM_VERBS, seed, 23)}${pick(POEM_IMAGES, seed, 29)}。`,
    `你的${pick(POEM_GESTURES, seed, 31)}穿过${pick(POEM_SPACES, seed, 37)}，把${pick(POEM_LIMITS, seed, 41)}译成${pick(POEM_COSMOS, seed, 43)}。`,
    `${pick(POEM_CLOSINGS, seed, 47)}；而${pick(POEM_MEMORIES, seed, 53)}，仍在${pick(POEM_FUTURES, seed, 59)}。`,
  ];
  const identity = calm > 65
    ? "寂静光锥的低熵编织者"
    : releases > 4
      ? "多重脉冲的湍流铸星者"
      : "星际压差的边界守望者";
  const pattern = `${match.catalog} 型态映射 / ${Math.round(match.signature.symmetry * 100)}% 对称星图`;
  const narrative = `你的手部星图与${match.nameZh}（${match.catalog}）产生形态共振：${match.matchReason}${match.feature}`;
  const inspirations = Array.from(new Set([
    pick(INSPIRATION_BANK, seed, 61),
    pick(INSPIRATION_BANK, seed, 67),
    pick(INSPIRATION_BANK, seed, 71),
  ])).slice(0, 3);

  return {
    nebulaName: name,
    generationId: code,
    poem,
    identity,
    pattern,
    narrative,
    inspiration: inspirations,
  };
}

export const DEFAULT_COSMIC_MATCH = matchCosmicProfile({
  palmScale: 0.5,
  fingerSpan: 0.56,
  symmetry: 0.66,
  aspect: 0.56,
  openness: 1,
  orientation: 0.5,
});
