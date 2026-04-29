import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Login from "./Login";
import Onboarding from "./Onboarding";
import Chat from "./Chat";

type Profile = {
  ai_name: string | null;
  voice_id: string | null;
  onboarded: boolean;
};

const Index = () => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("ai_name, voice_id, onboarded")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data ?? { ai_name: null, voice_id: null, onboarded: false });
        setProfileLoading(false);
      });
  }, [user]);

  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  if (!user) return <Login />;

  if (!profile?.onboarded || editing) {
    return (
      <Onboarding
        userId={user.id}
        onDone={async () => {
          const { data } = await supabase
            .from("profiles")
            .select("ai_name, voice_id, onboarded")
            .eq("id", user.id)
            .maybeSingle();
          setProfile(data ?? null);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Chat
      userId={user.id}
      aiName={profile.ai_name || "Aurora"}
      voiceId={profile.voice_id || "pt-female"}
      onEditProfile={() => setEditing(true)}
      onSignOut={async () => {
        await supabase.auth.signOut();
      }}
    />
  );
};

export default Index;
