// Byte helpers for the paths that carry audio over the bridge. RN has no
// Buffer and no btoa / atob to lean on, so these are written out; they are
// small, and every one is checked against Node's in Jest.

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const bytesToBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = [];
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (first << 16) | (second << 8) | third;
    parts.push(
      BASE64[(triple >> 18) & 63],
      BASE64[(triple >> 12) & 63],
      index + 1 < bytes.length ? BASE64[(triple >> 6) & 63] : "=",
      index + 2 < bytes.length ? BASE64[triple & 63] : "="
    );
  }
  return parts.join("");
};

const HEX = /^[0-9a-fA-F]*$/;

// Hex text → bytes. Anything that is not clean, even-length hex gives no
// bytes at all (the caller treats that as "no audio"), never a throw.
export const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) {
    return new Uint8Array(0);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const BASE64_VALUE = new Map<string, number>(
  Array.from(BASE64, (char, index) => [char, index] as const)
);

// One base64url segment (a JWT part: no padding, `-_` for `+/`) → UTF-8
// text, or null when it is not base64 at all.
export const base64UrlToUtf8 = (segment: string): string | null => {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*$/.test(normalized) || normalized.length % 4 === 1) {
    return null;
  }
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of normalized) {
    buffer = (buffer << 6) | (BASE64_VALUE.get(char) as number);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(
      bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("")
    );
  } catch {
    return null;
  }
};
