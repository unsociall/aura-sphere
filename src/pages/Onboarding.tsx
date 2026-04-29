import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticleSphere } from "@/components/ParticleSphere";
import { VOICE_OPTIONS, type VoiceId } from "@/lib/types";
import { speak } from "@/lib/speech";
import { supabase } from "@/integrations/supabase/client";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [aiName, setAiName] = useState("Aurora");
  const [voiceId, setVoiceId] = useState<VoiceId>("pt-female");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Pre-fill if profile exists
    supabase
      .from("profiles")
      .select("ai_name, voice_id")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.ai_name) setAiName(data.ai_name);
        if (data?.voice_id) setVoiceId(data.voice_id as VoiceId);
      });
  }, [userId]);

  const preview = (id: VoiceId) => {
    const cfg = VOICE_OPTIONS.find((v) => v.id === id)!;
    const sample = cfg.lang.startsWith("pt")
      ? `Olá, eu sou ${aiName || "sua IA"}. Estou aqui para conversar com você.`
      : `Hello, I am ${aiName || "your AI"}. I'm here to chat with you.`;
    speak(sample, id);
  };

  const save = async () => {
    if (!aiName.trim()) {
      toast.error("Dê um nome à sua IA");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ai_name: aiName.trim(), voice_id: voiceId, onboarded: true });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }
    onDone();
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="w-40 h-40 sm:w-48 sm:h-48">
          <ParticleSphere state="responding" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Personalize sua IA</h1>
          <p className="text-muted-foreground text-sm">Escolha um nome e uma voz. Pode mudar depois.</p>
        </div>

        <div className="w-full space-y-2">
          <Label htmlFor="ai-name">Nome da IA</Label>
          <Input
            id="ai-name"
            value={aiName}
            onChange={(e) => setAiName(e.target.value)}
            placeholder="Ex: Aurora"
            maxLength={32}
            className="h-12 text-base"
          />
        </div>

        <div className="w-full space-y-2">
          <Label>Voz</Label>
          <div className="grid gap-2">
            {VOICE_OPTIONS.map((v) => {
              const active = voiceId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceId(v.id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      preview(v.id);
                    }}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary"
                    aria-label="Ouvir prévia"
                  >
                    <Volume2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={save} disabled={saving} size="lg" className="w-full h-12 mt-2">
          {saving ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </main>
  );
}