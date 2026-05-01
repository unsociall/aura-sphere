import { VOICE_OPTIONS, type VoiceId } from "./types";

export function getVoiceConfig(voiceId: VoiceId | string | null) {
  return VOICE_OPTIONS.find((v) => v.id === voiceId) ?? VOICE_OPTIONS[0];
}

export function speak(text: string, voiceId: VoiceId | string | null, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const cfg = getVoiceConfig(voiceId);
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = cfg.lang;
  utter.rate = 1;
  utter.pitch = cfg.gender === "female" ? 1.15 : 0.9;

  const pickVoice = () => {
    const voices = synth.getVoices();
    const langMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(cfg.lang.toLowerCase().slice(0, 2)));
    const pool = langMatches.length ? langMatches : voices;
    const wanted = pool.find((v) =>
      cfg.gender === "female"
        ? /female|woman|aur|nov|mar|sam|luc|joana|fran|google.*female/i.test(v.name)
        : /male|man|atl|orion|dan|paul|carl|ricar|google.*male/i.test(v.name)
    );
    utter.voice = wanted ?? pool[0] ?? null;
    utter.onend = () => onEnd?.();
    synth.speak(utter);
  };

  if (synth.getVoices().length === 0) {
    synth.addEventListener("voiceschanged", pickVoice, { once: true });
  } else {
    pickVoice();
  }
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

type RecognitionLike = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

export function createRecognition(lang: string): RecognitionLike | null {
  const SR = ((window as Record<string, unknown>).SpeechRecognition || (window as Record<string, unknown>).webkitSpeechRecognition) as typeof SpeechRecognition | undefined;
  if (!SR) return null;
  const rec: RecognitionLike = new SR();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  return rec;
}