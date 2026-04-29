export type SphereState = "idle" | "listening" | "thinking" | "responding";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export const VOICE_OPTIONS = [
  { id: "pt-female", label: "Aurora (PT-BR feminina)", lang: "pt-BR", gender: "female" },
  { id: "pt-male", label: "Atlas (PT-BR masculina)", lang: "pt-BR", gender: "male" },
  { id: "en-female", label: "Nova (EN feminina)", lang: "en-US", gender: "female" },
  { id: "en-male", label: "Orion (EN masculina)", lang: "en-US", gender: "male" },
] as const;

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];