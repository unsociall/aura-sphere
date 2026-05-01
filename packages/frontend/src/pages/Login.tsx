import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";
import { ParticleSphere } from "@/components/ParticleSphere";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5.1l-6-5c-1.9 1.4-4.3 2.1-6.9 2.1-5.2 0-9.7-3.1-11.3-7.5l-6.6 5C9.6 39 16.3 43.5 24 43.5z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.4 5.4l6 5C40 35.4 43.5 30 43.5 24c0-1.2-.1-2.4-.3-3.5z"/>
  </svg>
);

export default function Login() {
  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com Google");
      return;
    }
  };

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56">
          <ParticleSphere state="idle" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
            Sua IA com voz e presença
          </h1>
          <p className="text-muted-foreground text-balance">
            Entre com sua conta Google para escolher um nome e uma voz para a sua IA.
          </p>
        </div>
        <Button onClick={handleGoogle} size="lg" variant="secondary" className="w-full gap-3 h-12">
          <GoogleIcon />
          Entrar com Google
        </Button>
      </div>
    </main>
  );
}