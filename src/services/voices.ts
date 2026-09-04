import type { Companion } from "../store/companions";
import type { ChatThread } from "../screens/chat/types";

/**
 * Who sounds like what. A companion's voice is one Doubao Seed-TTS 2.0
 * speaker (火山引擎 豆包语音合成模型 2.0, resource `seed-tts-2.0`), drawn at
 * random from the pool for their gender when the character is created and
 * persisted on the companion record and the Message thread (`voiceId`).
 * The same id also decides the on-device fallback: AVSpeechSynthesizer is
 * asked for a voice of the same gender when the cloud is not reachable.
 *
 * Female companions get female voices, Male companions male voices.
 * Non-binary companions draw from both pools (there is no neutral Doubao
 * pool worth the name); the draw is still random and still persisted.
 */
export type VoiceGender = "female" | "male";

export type Voice = {
  // The Doubao speaker id; also the persisted `voiceId`.
  id: string;
  // The console's name for the speaker, for logs and a future picker.
  label: string;
  gender: VoiceGender;
};

export const FEMALE_VOICES: readonly Voice[] = [
  { id: "zh_female_xiaohe_uranus_bigtts", label: "小何 2.0", gender: "female" },
  { id: "zh_female_vv_uranus_bigtts", label: "Vivi 2.0", gender: "female" },
  {
    id: "zh_female_shuangkuaisisi_uranus_bigtts",
    label: "爽快思思 2.0",
    gender: "female",
  },
  {
    id: "zh_female_qingxinnvsheng_uranus_bigtts",
    label: "清新女声 2.0",
    gender: "female",
  },
  {
    id: "zh_female_meilinvyou_uranus_bigtts",
    label: "魅力女友 2.0",
    gender: "female",
  },
  {
    id: "zh_female_linjianvhai_uranus_bigtts",
    label: "邻家女孩 2.0",
    gender: "female",
  },
  {
    id: "zh_female_tianmeixiaoyuan_uranus_bigtts",
    label: "甜美校园 2.0",
    gender: "female",
  },
  { id: "zh_female_cancan_uranus_bigtts", label: "灿灿 2.0", gender: "female" },
];

export const MALE_VOICES: readonly Voice[] = [
  { id: "zh_male_m191_uranus_bigtts", label: "云舟 2.0", gender: "male" },
  { id: "zh_male_taocheng_uranus_bigtts", label: "小天 2.0", gender: "male" },
  { id: "zh_male_liufei_uranus_bigtts", label: "刘飞 2.0", gender: "male" },
  {
    id: "zh_male_ruyayichen_uranus_bigtts",
    label: "儒雅逸辰 2.0",
    gender: "male",
  },
  { id: "zh_male_dayi_uranus_bigtts", label: "大壹 2.0", gender: "male" },
  {
    id: "zh_male_shaonianzixin_uranus_bigtts",
    label: "少年梓辛 2.0",
    gender: "male",
  },
];

export const VOICES: readonly Voice[] = [...FEMALE_VOICES, ...MALE_VOICES];

// The seeded people's fixed voices: Amanda a woman, Kevin and Chad men.
export const SEED_VOICES = {
  kevin: "zh_male_m191_uranus_bigtts",
  chad: "zh_male_ruyayichen_uranus_bigtts",
  amanda: "zh_female_xiaohe_uranus_bigtts",
} as const;

export const voiceById = (id?: string): Voice | undefined =>
  id ? VOICES.find((voice) => voice.id === id) : undefined;

export const voicePoolForGender = (gender?: string): readonly Voice[] => {
  switch (gender) {
    case "Female":
      return FEMALE_VOICES;
    case "Male":
      return MALE_VOICES;
    default:
      return VOICES;
  }
};

// Draw one voice for a new character. `random` is Math.random unless a test
// wants the draw pinned.
export const assignVoiceForGender = (
  gender: string | undefined,
  random: () => number = Math.random
): string => {
  const pool = voicePoolForGender(gender);
  const index = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(random() * pool.length))
  );
  return pool[index].id;
};

// Whether a stored voice still fits a (possibly edited) gender.
export const voiceMatchesGender = (
  voiceId: string | undefined,
  gender: string | undefined
): boolean => {
  const voice = voiceById(voiceId);
  if (!voice) {
    return false;
  }
  return voicePoolForGender(gender).includes(voice);
};

// Keep a matching voice, otherwise draw a new one for the gender.
export const voiceIdForGender = (
  current: string | undefined,
  gender: string | undefined,
  random: () => number = Math.random
): string =>
  voiceMatchesGender(current, gender)
    ? (current as string)
    : assignVoiceForGender(gender, random);

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash;
};

export type VoicePersonInput = {
  id?: string;
  thread?: ChatThread;
  companion?: Companion;
};

// The voice a person speaks with, from whatever is stored about them: the
// thread's pick, the companion record's, a seeded person's fixed voice, and
// for people persisted before voices existed a stable draw from their gender's
// pool (hashed from their id, so Amanda from an old blob is always the same
// woman and never a man).
export const voiceForPerson = ({
  id,
  thread,
  companion,
}: VoicePersonInput): Voice => {
  const stored = voiceById(thread?.voiceId) ?? voiceById(companion?.voiceId);
  if (stored) {
    return stored;
  }
  const personId = thread?.id ?? companion?.id ?? id ?? "";
  const seeded =
    personId in SEED_VOICES
      ? voiceById(SEED_VOICES[personId as keyof typeof SEED_VOICES])
      : undefined;
  if (seeded) {
    return seeded;
  }
  const pool = voicePoolForGender(thread?.gender ?? companion?.gender);
  return pool[hashString(personId) % pool.length];
};
