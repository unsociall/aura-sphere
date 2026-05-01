# Aura Sphere

Projeto Aura Sphere com frontend em Vite/React e backend bridge em FastAPI.

## Visão geral

- frontend app em React com Vite no diretório raiz.
- `packages/bridge`: backend FastAPI para rotas de chat, memória e pesquisa.
- `packages/mempalace`: motor de memória local de exemplo.
- `docker-compose.yml`: stack local com Postgres, Redis, bridge, frontend e proxy Nginx.

## Como iniciar

1. Copie o `.env.example` para `.env`:
   ```bash
   ./scripts/setup.sh
   ```

2. Inicie a stack Docker:
   ```bash
   ./scripts/dev.sh
   ```

3. Acesse o frontend em `http://localhost:3000`.

## Endpoints do backend

- `GET /api/v1/health` - health check.
- `POST /api/v1/chat` - endpoint de chat streaming.
- `POST /api/v1/memory` - salva um item de memória.
- `GET /api/v1/history?user_id=...` - busca histórico de chat.
- `GET /api/v1/search?q=...&user_id=...` - pesquisa por conteúdo de memória.

## Notas

- O `.env` é ignorado e não deve ser commitado.
- Use `VITE_API_URL` para apontar o frontend ao bridge.
- O chat inclui agora busca na conversa e limpeza de histórico diretamente na interface.
- O chat também suporta múltiplos provedores: `Lovable`, `Anthropic / Claude` e `OpenAI` via configurações de função do Supabase.
- Configure `LOVABLE_API_KEY`, `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` no ambiente, e use `AI_PROVIDER` para definir um provedor padrão.
- O `packages/mempalace` é um stub de memória local que pode ser substituído por um submodule real posteriormente.
