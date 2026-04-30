import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Mic, MicOff, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ParticleSphere } from "@/components/ParticleSphere";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, ParticleShape, SphereState, VoiceId } from "@/lib/types";
import { createRecognition, getVoiceConfig, speak, stopSpeaking } from "@/lib/speech";
import { inferShape } from "@/lib/shapes";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { toast } from "sonner";

const STATE_LABELS: Record<SphereState, string> = {
  idle: "Pronta",
  listening: "Ouvindo…",
  thinking: "Pensando…",
  responding: "Respondendo…",
};

export default function Chat({
  userId,
  aiName,
  voiceId,
  onSignOut,
  onEditProfile,
}: {
  userId: string;
  aiName: string;
  voiceId: VoiceId | string;
  onSignOut: () => void;
  onEditProfile: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<SphereState>("idle");
  const [shape, setShape] = useState<ParticleShape>("sphere");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lang = getVoiceConfig(voiceId).lang;

  // Live mic volume — drives particle vibration. Active only while recording.
  const { volume: micVolume, active: micActive } = useVoiceActivity(recording);

  // While the AI speaks (state === "responding"), simulate a soft volume so
  // the particles also "speak". Otherwise use the live mic volume.
  const [ttsPulse, setTtsPulse] = useState(0);
  useEffect(() => {
    if (state !== "responding") {
      setTtsPulse(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      // pseudo-speech envelope
      const v =
        0.18 +
        Math.abs(Math.sin(t * 6.2)) * 0.18 +
        Math.abs(Math.sin(t * 2.7 + 1.3)) * 0.12;
      setTtsPulse(Math.min(0.6, v));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const liveVolume = recording ? micVolume : ttsPulse;

  // Auto-switch to "listening" while the user actually speaks into the mic.
  useEffect(() => {
    if (recording && micActive && state !== "listening") {
      setState("listening");
    }
  }, [recording, micActive, state]);

  // Load history
  useEffect(() => {
    supabase
      .from("chat_messages")
      .select("id, role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data.map((m) => ({ id: m.id, role: m.role as any, content: m.content })));
      });
  }, [userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state]);

  // Update particle shape based on conversation context
  useEffect(() => {
    if (messages.length === 0) {
      setShape("sphere");
      return;
    }
    const last = messages[messages.length - 1];
    // Prefer assistant content if available, otherwise the user's latest message
    const text =
      last.role === "assistant"
        ? last.content
        : messages.slice().reverse().find((m) => m.role === "assistant")?.content || last.content;
    setShape(inferShape(text));
  }, [messages]);

  const persist = async (msg: ChatMessage) => {
    await supabase.from("chat_messages").insert({ user_id: userId, role: msg.role, content: msg.content });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    stopSpeaking();

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    persist(userMsg);

    setState("thinking");

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          aiName,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error("Limite de uso atingido. Tente novamente em instantes.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error("Erro ao falar com a IA");
        setState("idle");
        return;
      }

      setState("responding");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      let added = false;
      let done = false;

      const upsert = (chunk: string) => {
        assistantText += chunk;
        setMessages((prev) => {
          if (!added) {
            added = true;
            return [...prev, { role: "assistant", content: assistantText }];
          }
          const copy = prev.slice();
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: assistantText };
          return copy;
        });
      };

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (assistantText) {
        await persist({ role: "assistant", content: assistantText });
        speak(assistantText, voiceId, () => setState("idle"));
      } else {
        setState("idle");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão");
      setState("idle");
    }
  };

  const startRecording = () => {
    const rec = createRecognition(lang);
    if (!rec) {
      toast.error("Reconhecimento de voz não suportado neste navegador. Use Chrome/Edge.");
      return;
    }
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      console.error("STT error", e);
      if (e.error === "not-allowed") toast.error("Permissão de microfone negada");
      setRecording(false);
      setState("idle");
    };
    rec.onend = () => {
      setRecording(false);
      const text = finalText.trim() || (input || "").trim();
      if (text) {
        setState("thinking");
        sendText(text);
      } else {
        setState("idle");
      }
    };
    recognitionRef.current = rec;
    setRecording(true);
    setState("listening");
    try {
      rec.start();
    } catch (e) {
      console.error(e);
      setRecording(false);
      setState("idle");
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
  };

  const onMicClick = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <main className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 backdrop-blur-sm">
        <div>
          <h1 className="text-base font-semibold tracking-tight">{aiName}</h1>
          <p className="text-xs text-muted-foreground">{STATE_LABELS[state]}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEditProfile} aria-label="Configurações">
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Sphere */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-2 pb-1">
        <div className="w-full max-w-sm aspect-square max-h-[42vh]">
          <ParticleSphere state={state} shape={shape} volume={liveVolume} />
        </div>
        <div
          className={`mt-1 text-xs uppercase tracking-[0.25em] font-medium animate-fade-in ${
            state === "idle" ? "text-muted-foreground" : "text-primary animate-pulse-ring"
          }`}
        >
          {STATE_LABELS[state]}
        </div>
      </section>

      {/* Messages */}
      <section
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Comece uma conversa — digite ou toque no microfone.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_pre]:my-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Input */}
      <footer className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/50 bg-background/80 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendText(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? "Ouvindo…" : "Digite uma mensagem"}
            disabled={state === "thinking"}
            className="h-12 text-base flex-1"
            inputMode="text"
          />
          <Button
            type="button"
            onClick={onMicClick}
            variant={recording ? "destructive" : "secondary"}
            size="icon"
            className="h-12 w-12 shrink-0"
            aria-label={recording ? "Parar gravação" : "Gravar voz"}
          >
            {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || state === "thinking"}
            className="h-12 w-12 shrink-0"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </footer>
    </main>
  );
}