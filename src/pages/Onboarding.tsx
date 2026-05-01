import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParticleSphere } from "@/components/ParticleSphere";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VOICE_OPTIONS, type LocalProfile, type VoiceId } from "@/lib/types";
import { getProfileStorageKey, loadLocalProfile, saveLocalProfile } from "@/lib/localProfile";
import { speak } from "@/lib/speech";
import { supabase } from "@/integrations/supabase/client";
import { Volume2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [aiName, setAiName] = useState("Aurora");
  const [voiceId, setVoiceId] = useState<VoiceId>("pt-female");
  const [tone, setTone] = useState<LocalProfile["tone"]>("friendly");
  const [interests, setInterests] = useState("");
  const [personality, setPersonality] = useState("");
  const [autoMode, setAutoMode] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const localProfile = loadLocalProfile(userId);
    setTone(localProfile.tone);
    setInterests(localProfile.interests);
    setPersonality(localProfile.personality);
    setAutoMode(localProfile.autoMode);

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
    saveLocalProfile(userId, {
      tone,
      interests: interests.trim(),
      personality: personality.trim(),
      autoMode,
    });
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

        <div className="w-full space-y-2">
          <Label htmlFor="tone">Estilo da conversa</Label>
          <Select value={tone} onValueChange={(value) => setTone(value as LocalProfile["tone"])}>
            <SelectTrigger id="tone" className="w-full h-12 text-sm">
              <SelectValue placeholder="Selecione um estilo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Amigável</SelectItem>
              <SelectItem value="professional">Profissional</SelectItem>
              <SelectItem value="creative">Criativo</SelectItem>
              <SelectItem value="direct">Direto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full space-y-2">
          <Label htmlFor="interests">Interesses / objetivos</Label>
          <Textarea
            id="interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="Ex: desenvolvimento mobile, design minimalista, automação de tarefas"
            className="min-h-[120px] text-sm"
          />
        </div>

        <div className="w-full space-y-2">
          <Label htmlFor="personality">Minha personalidade</Label>
          <Textarea
            id="personality"
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder="Escreva como você gosta de ser tratado: descontraído, objetivo, criativo, paciente..."
            className="min-h-[120px] text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted p-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium">Modo proativo</p>
            <p>Quando ativado, sua IA fará sugestões e analisará projetos automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={() => setAutoMode((prev) => !prev)}
            className={`h-10 rounded-lg px-4 text-sm font-medium transition ${
              autoMode ? "bg-primary text-primary-foreground" : "bg-background border border-border"
            }`}
          >
            {autoMode ? "Ativado" : "Desativado"}
          </button>
        </div>

        <Button onClick={save} disabled={saving} size="lg" className="w-full h-12 mt-2">
          {saving ? "Salvando..." : "Continuar"}
        </Button>
      </div>
    </main>
  );
}