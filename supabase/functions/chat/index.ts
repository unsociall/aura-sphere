import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROVIDERS = ["lovable", "anthropic", "openai"] as const;
type Provider = (typeof PROVIDERS)[number];

const defaultProvider = (Deno.env.get("AI_PROVIDER") || "lovable") as Provider;

function buildSystemMessage(aiName: string) {
  return `You are ${aiName || "Aura"}, a warm, concise, voice-first AI companion. Replies should be conversational and short unless the user asks for more detail. Always answer in the user's language.`;
}

function buildAnthropicPrompt(aiName: string, messages: Array<{ role: string; content: string }>) {
  const system = buildSystemMessage(aiName);
  const body = messages
    .map((message) => {
      const role = message.role === "assistant" ? "Assistant" : "Human";
      return `${role}: ${message.content}`;
    })
    .join("\n");
  return `${system}\n\n${body}\nAssistant:`;
}

async function callLovable(apiKey: string, aiName: string, messages: Array<{ role: string; content: string }>) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: buildSystemMessage(aiName) }, ...messages],
      stream: true,
    }),
  });
}

async function callAnthropic(apiKey: string, aiName: string, messages: Array<{ role: string; content: string }>) {
  return fetch("https://api.anthropic.com/v1/complete", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3.5-sonic",
      prompt: buildAnthropicPrompt(aiName, messages),
      max_tokens_to_sample: 800,
      stream: true,
    }),
  });
}

async function callOpenAI(apiKey: string, aiName: string, messages: Array<{ role: string; content: string }>) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: buildSystemMessage(aiName) }, ...messages],
      stream: true,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, aiName, provider: requestedProvider } = await req.json();
    const provider = (requestedProvider || defaultProvider).toLowerCase() as Provider;

    if (!PROVIDERS.includes(provider)) {
      return new Response(JSON.stringify({ error: `Unsupported provider ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let response: Response;
    switch (provider) {
      case "anthropic": {
        const key = Deno.env.get("ANTHROPIC_API_KEY");
        if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
        response = await callAnthropic(key, aiName, messages);
        break;
      }
      case "openai": {
        const key = Deno.env.get("OPENAI_API_KEY");
        if (!key) throw new Error("OPENAI_API_KEY not configured");
        response = await callOpenAI(key, aiName, messages);
        break;
      }
      default: {
        const key = Deno.env.get("LOVABLE_API_KEY");
        if (!key) throw new Error("LOVABLE_API_KEY not configured");
        response = await callLovable(key, aiName, messages);
      }
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Add funds in Workspace Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI provider error:", provider, response.status, text);
      return new Response(JSON.stringify({ error: "AI provider error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
