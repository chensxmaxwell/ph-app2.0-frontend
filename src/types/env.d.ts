declare module "@env" {
  export const AWS_ACCESS_KEY: string;
  export const AWS_SECRET_KEY: string;
  export const IOS_CLIENT_ID: string;
  export const WEB_CLIENT_ID: string;
  export const BACKEND_URL: string;
  export const LLM_API_KEY: string;
  export const LLM_BASE_URL: string;
  export const LLM_MODEL: string;
  // 豆包语音 (Doubao speech console) credentials for cloud TTS. The new
  // console issues one API key; older apps have an APP ID + Access Token.
  export const TTS_API_KEY: string;
  export const TTS_APP_ID: string;
  export const TTS_ACCESS_TOKEN: string;
}
