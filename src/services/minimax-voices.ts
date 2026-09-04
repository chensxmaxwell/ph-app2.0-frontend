import { SEED_VOICES, Voice, VoiceGender } from "./voices";

/**
 * MiniMax's system voices, and which one each of our Doubao speakers becomes
 * when the MiniMax key is the one saved. A person's persisted `voiceId` is a
 * Doubao speaker id (voices.ts); MiniMax is asked for the voice paired with
 * it here, always of the same gender, so a companion sounds like the same
 * kind of person on either cloud. The ids are MiniMax's documented system
 * voice ids (T2A v2 `voice_setting.voice_id`; 系统音色列表).
 */
export type MiniMaxVoice = {
  id: string;
  // MiniMax's own name for the voice.
  label: string;
  gender: VoiceGender;
  language: "zh" | "en";
};

export const MINIMAX_VOICES: readonly MiniMaxVoice[] = [
  // Mandarin, female
  { id: "wumei_yujie", label: "妩媚御姐", gender: "female", language: "zh" },
  { id: "female-tianmei", label: "甜美女性", gender: "female", language: "zh" },
  {
    id: "Chinese (Mandarin)_Warm_Girl",
    label: "温暖少女",
    gender: "female",
    language: "zh",
  },
  {
    id: "Chinese (Mandarin)_Soft_Girl",
    label: "柔和少女",
    gender: "female",
    language: "zh",
  },
  { id: "female-shaonv", label: "少女", gender: "female", language: "zh" },
  { id: "female-yujie", label: "御姐", gender: "female", language: "zh" },
  { id: "danya_xuejie", label: "淡雅学姐", gender: "female", language: "zh" },
  { id: "diadia_xuemei", label: "嗲嗲学妹", gender: "female", language: "zh" },
  {
    id: "female-chengshu",
    label: "成熟女性",
    gender: "female",
    language: "zh",
  },
  // Mandarin, male
  { id: "junlang_nanyou", label: "俊朗男友", gender: "male", language: "zh" },
  { id: "male-qn-jingying", label: "精英青年", gender: "male", language: "zh" },
  {
    id: "Chinese (Mandarin)_Gentle_Youth",
    label: "温润青年",
    gender: "male",
    language: "zh",
  },
  {
    id: "Chinese (Mandarin)_Straightforward_Boy",
    label: "率真弟弟",
    gender: "male",
    language: "zh",
  },
  {
    id: "Chinese (Mandarin)_Gentleman",
    label: "温润男声",
    gender: "male",
    language: "zh",
  },
  {
    id: "Chinese (Mandarin)_Reliable_Executive",
    label: "沉稳高管",
    gender: "male",
    language: "zh",
  },
  // English, for the two US-English Doubao speakers
  {
    id: "English_Graceful_Lady",
    label: "Graceful Lady",
    gender: "female",
    language: "en",
  },
  {
    id: "English_radiant_girl",
    label: "Radiant Girl",
    gender: "female",
    language: "en",
  },
  {
    id: "English_Gentle-voiced_man",
    label: "Gentle-voiced Man",
    gender: "male",
    language: "en",
  },
];

// The seeds, by their personas: Kevin is playful and attentive (俊朗男友, the
// warm boyfriend), Chad direct and confident (精英青年), Amanda warm, witty
// and a little teasing (妩媚御姐).
export const MINIMAX_SEED_VOICES = {
  kevin: "junlang_nanyou",
  chad: "male-qn-jingying",
  amanda: "wumei_yujie",
} as const;

// Doubao speaker id → MiniMax voice id, one line per catalogued voice.
export const MINIMAX_VOICE_FOR: Readonly<Record<string, string>> = {
  // female
  [SEED_VOICES.amanda]: MINIMAX_SEED_VOICES.amanda, // Vivi 2.0
  zh_female_xiaohe_uranus_bigtts: "female-tianmei", // 小何 2.0
  zh_female_qingxinnvsheng_uranus_bigtts: "Chinese (Mandarin)_Warm_Girl", // 清新女声 2.0
  zh_female_tianmeixiaoyuan_uranus_bigtts: "Chinese (Mandarin)_Soft_Girl", // 甜美小源 2.0
  zh_female_tianmeitaozi_uranus_bigtts: "female-shaonv", // 甜美桃子 2.0
  zh_female_shuangkuaisisi_uranus_bigtts: "female-yujie", // 爽快思思 2.0
  zh_female_linjianvhai_uranus_bigtts: "danya_xuejie", // 邻家女孩 2.0
  zh_female_meilinvyou_uranus_bigtts: "diadia_xuemei", // 魅力女友 2.0
  zh_female_cancan_uranus_bigtts: "female-chengshu", // 知性灿灿 2.0
  en_female_dacey_uranus_bigtts: "English_Graceful_Lady", // Dacey
  en_female_stokie_uranus_bigtts: "English_radiant_girl", // Stokie
  // male
  [SEED_VOICES.kevin]: MINIMAX_SEED_VOICES.kevin, // 云舟 2.0
  [SEED_VOICES.chad]: MINIMAX_SEED_VOICES.chad, // 刘飞 2.0
  zh_male_taocheng_uranus_bigtts: "Chinese (Mandarin)_Gentle_Youth", // 小天 2.0
  zh_male_shaonianzixin_uranus_bigtts: "Chinese (Mandarin)_Straightforward_Boy", // 少年梓辛 2.0
  zh_male_ruyayichen_uranus_bigtts: "Chinese (Mandarin)_Gentleman", // 儒雅逸辰 2.0
  zh_male_dayi_uranus_bigtts: "Chinese (Mandarin)_Reliable_Executive", // 大壹 2.0
  en_male_tim_uranus_bigtts: "English_Gentle-voiced_man", // Tim
};

export const minimaxVoiceById = (id: string): MiniMaxVoice | undefined =>
  MINIMAX_VOICES.find((voice) => voice.id === id);

// The first catalogued MiniMax voice of a gender: for a Doubao voice the
// table above somehow misses (it must not; the test walks the catalogue).
const firstOfGender = (gender: VoiceGender): MiniMaxVoice =>
  MINIMAX_VOICES.find((voice) => voice.gender === gender) ??
  (minimaxVoiceById(MINIMAX_SEED_VOICES.kevin) as MiniMaxVoice);

// The MiniMax voice for a person's Doubao voice. An unknown voice still
// speaks (in Kevin's voice) — the cloud is never a reason for silence.
export const minimaxVoiceFor = (voice: Voice | undefined): MiniMaxVoice => {
  if (!voice) {
    return minimaxVoiceById(MINIMAX_SEED_VOICES.kevin) as MiniMaxVoice;
  }
  const mapped = minimaxVoiceById(MINIMAX_VOICE_FOR[voice.id] ?? "");
  return mapped && mapped.gender === voice.gender
    ? mapped
    : firstOfGender(voice.gender);
};
