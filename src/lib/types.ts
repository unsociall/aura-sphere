export type SphereState = "idle" | "listening" | "thinking" | "responding";

export type ParticleShape =
  | "sphere"
  | "question"
  | "wave"
  | "heart"
  | "torus"
  | "galaxy"
  | "cube";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type LocalProfile = {
  tone: "friendly" | "professional" | "creative" | "direct";
  interests: string;
  personality: string;
  autoMode: boolean;
};

export type ProjectTask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: "pending" | "in-progress" | "done";
  tasks: ProjectTask[];
  createdAt: string;
};

export const VOICE_OPTIONS = [
  { id: "pt-female", label: "Aurora (PT-BR feminina)", lang: "pt-BR", gender: "female" },
  { id: "pt-male", label: "Atlas (PT-BR masculina)", lang: "pt-BR", gender: "male" },
  { id: "en-female", label: "Nova (EN feminina)", lang: "en-US", gender: "female" },
  { id: "en-male", label: "Orion (EN masculina)", lang: "en-US", gender: "male" },
] as const;

export const AI_PROVIDER_OPTIONS = [
  { id: "lovable", label: "Lovable" },
  { id: "anthropic", label: "Anthropic / Claude" },
  { id: "openai", label: "OpenAI" },
] as const;

export type VoiceId = (typeof VOICE_OPTIONS)[number]["id"];
export type AiProvider = (typeof AI_PROVIDER_OPTIONS)[number]["id"];
