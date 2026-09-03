export type SharePalmSignature = {
  palmScale: number;
  fingerSpan: number;
  symmetry: number;
  aspect: number;
  openness: number;
  orientation: number;
};

export type ArchiveShareSeed = {
  seed: number;
  hue: number;
  duration: number;
  pressureUsed: number;
  releases: number;
  calm: number;
  palmSignature: SharePalmSignature;
};

export type DecodedArchivePayload =
  | { format: "compact"; data: ArchiveShareSeed }
  | { format: "legacy"; data: Record<string, unknown> };

const PAYLOAD_VERSION = 2;
const MAX_ARCHIVE_QUERY_LENGTH = 12_000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function quantizeUnit(value: number) {
  return Math.round(clamp(value, 0, 1) * 1000);
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Keep only the numeric seed needed to rebuild a report. The former codec put
 * every Chinese paragraph into the URL, which could exceed QR version 40.
 */
export function encodeArchivePayload(result: ArchiveShareSeed) {
  const signature = result.palmSignature;
  const compact = [
    PAYLOAD_VERSION,
    result.seed >>> 0,
    Math.round(result.hue),
    Math.round(result.duration),
    Math.round(result.pressureUsed),
    Math.round(result.releases),
    Math.round(result.calm),
    quantizeUnit(signature.palmScale),
    quantizeUnit(signature.fingerSpan),
    quantizeUnit(signature.symmetry),
    quantizeUnit(signature.aspect),
    quantizeUnit(signature.openness),
    quantizeUnit(signature.orientation),
  ] as const;
  return encodeBase64Url(JSON.stringify(compact));
}

export function decodeArchivePayload(value: string): DecodedArchivePayload | null {
  if (!value || value.length > MAX_ARCHIVE_QUERY_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (Array.isArray(parsed) && parsed[0] === PAYLOAD_VERSION && parsed.length >= 13) {
      const values = parsed.slice(1, 13).map(Number);
      if (!values.every(Number.isFinite)) return null;
      const [seed, hue, duration, pressureUsed, releases, calm, ...signature] = values;
      return {
        format: "compact",
        data: {
          seed: seed >>> 0,
          hue: clamp(Math.round(hue), 0, 720),
          duration: clamp(Math.round(duration), 1, 3600),
          pressureUsed: clamp(Math.round(pressureUsed), 0, 100),
          releases: clamp(Math.round(releases), 0, 999),
          calm: clamp(Math.round(calm), 0, 100),
          palmSignature: {
            palmScale: clamp(signature[0] / 1000, 0, 1),
            fingerSpan: clamp(signature[1] / 1000, 0, 1),
            symmetry: clamp(signature[2] / 1000, 0, 1),
            aspect: clamp(signature[3] / 1000, 0, 1),
            openness: clamp(signature[4] / 1000, 0, 1),
            orientation: clamp(signature[5] / 1000, 0, 1),
          },
        },
      };
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { format: "legacy", data: parsed as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}
