# Histórico da conversa: Integração Aura-Sphere ↔ MemPalace

Data inicial da conversa: 2026-05-01  
Repositórios alvo: unsociall/aura-sphere (principal), unsociall/aura-sphere-168919a3 (alternativo)

## Resumo executivo
Objetivo: transformar o projeto Aura-Sphere em um aplicativo completo com:
- Frontend moderno (Next.js/React) estilo ChatGPT com Navbar fixa e componente "Esfera".
- Backend bridge (FastAPI) que integra o MemPalace (mempalace-Aya-fork) como camada de memória.
- Integração completa: salvar mensagens como memórias (diary/drawers), busca semântica, múltiplas conversas, persistência local.
- Orquestração local via Docker Compose (Postgres, Redis, bridge, frontend, nginx).

## Decisões de arquitetura (feitas / recomendadas)
- Monorepo com workspaces (packages/frontend, packages/bridge, packages/mempalace submodule).
- Bridge: FastAPI (Python) expondo endpoints: /api/v1/chat, /api/v1/memory, /api/v1/search.
- Frontend: Next.js + TypeScript + Zustand store; componente Sphere mantido e integrado ao estado da IA.
- Comunicação: HTTP local (frontend -> bridge), nginx reverso opcional.
- Dev fallback: em ENV != production, bridge retorna um DEV_USER quando não há token (facilita desenvolvimento).
- Autenticação: JWT (HS256) com SECRET_KEY; script de geração de token (dev) incluído.
- Segurança: CORS restrito, headers CSP/HSTS, rate limiting (slowapi/nginx), validação de payloads.

## O que foi criado/planejado durante a conversa
- Scaffold (arquivos mínimos) para:
  - packages/bridge (FastAPI scaffold, config, scripts/generate_jwt.py, requirements)
    - packages/frontend (Next.js scaffold minimal, env.example)
      - docker-compose.yml (Postgres, Redis, bridge, frontend, nginx)
        - scripts/setup.sh, scripts/dev.sh
          - .gitmodules apontando para mempalace-Aya-fork
            - README com quickstart e instruções
            - Design e código propostos (muitos arquivos de exemplo/boilerplate gerados no chat: services, components, styles, store, endpoints).
            - Testes básicos propostos (pytest/Jest).

            ## Ações recomendadas / próximos passos
            1. Commitar este histórico no repositório para referência do Copilot/Dev team.
            2. Revisar e substituir fallback DEV_USER antes do deploy em produção.
            3. Integrar o submodule mempalace e testar MemoryService (ajustar implementações TODO).
            4. Rodar CI: lint, type-check, testes; adicionar scanner de vulnerabilidades (Trivy).
            5. Remover/rotacionar SECRET_KEY de desenvolvimento antes do deploy.
            6. Reforçar CSP e CORS com políticas estritas em produção.

            ## Como usar (resumo rápido)
            - Setup:
              - scripts/setup.sh (gera .env se necessário)
                - scripts/dev.sh (leva docker-compose up + inicia dev)
                - Endpoints úteis:
                  - Frontend: http://localhost:3000
                    - Bridge: http://localhost:8000
                      - API docs: http://localhost:8000/docs
                      - JWT dev:
                        - python packages/bridge/scripts/generate_jwt.py --user admin@example.com

                        ## Notas importantes
                        - Este documento é um resumo prático (não transcrição literal). Se você quiser a transcrição completa desta conversa (todo o texto trocado), peça explicitamente — eu gerarei o arquivo completo.
                        - Se houver qualquer conteúdo sensível nesta conversa, reveja e remova antes de commitar.

                        ## Autor / Referência
                        - Gerado a partir da conversa com o assistente (ChatGPT/Copilot) em 2026-05-01.