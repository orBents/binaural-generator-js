# BIWAVE
Aplicacao web de relaxamento e foco com mix de `Binaural + Lo-Fi + Noise`, arquitetura modular e foco em experiencia mobile.

## Visao do Projeto
O BIWAVE evoluiu de um gerador simples para uma plataforma sonora com:
- camadas de audio independentes (Binaural, Beat Lo-Fi, Noise)
- controle de mix com protecao anti-clipping
- interface mobile-first com feedback visual
- estado global centralizado para previsibilidade de comportamento

## Novas Metas
1. Tornar o **Beat** a camada principal por padrao.
2. Garantir por regra de sistema: **Binaural <= 10% do volume do Beat**.
3. Centralizar politicas de volume em um unico ponto de configuracao.
4. Manter arquitetura escalavel (Controller-Engine-UI-State).
5. Evoluir para presets terapeuticos e sessoes guiadas automatizadas.

## Regras de Mix (Atual)
- O Beat e prioritario na mix.
- O volume Binaural e automaticamente limitado a 10% do volume do Beat.
- O `Master Bus` usa `DynamicsCompressorNode` para reduzir risco de clipping.
- O volume geral e aplicado no estagio final (`masterGain`) sem alterar o balance interno.

Implementacao central dessas regras:
- `src/config/audioConfig.mjs`
- `src/state.js`
- `src/core/BinauralEngine.mjs` (enforcement em runtime)

## Arquitetura Recomendada
```text
/biwave
├── /assets
├── /css
│   ├── theme.css
│   ├── layout.css
│   └── components.css
├── /docs
├── /src
│   ├── /config
│   │   └── audioConfig.mjs
│   ├── /core
│   │   ├── BinauralEngine.mjs
│   │   └── LofiEngine.mjs
│   ├── /ui
│   │   └── Visualizer.mjs
│   ├── /utils
│   │   └── presets.mjs
│   ├── app.js
│   └── state.js
├── index.html
├── manifest.json
└── sw.js
```

## Papel de Cada Camada
- `src/app.js`: orquestrador de UI e eventos.
- `src/state.js`: estado global da aplicacao.
- `src/config/audioConfig.mjs`: politicas centrais de volume e limites.
- `src/core/*Engine.mjs`: audio engine sem dependencia direta de DOM.
- `src/ui/*`: componentes visuais e feedback.

## Contratos de Arquitetura
- `Controller`: nunca cria regra de negocio de audio; apenas encaminha eventos.
- `State`: e a fonte unica da verdade para modo, volumes, play/pause e aba ativa.
- `Engine`: recebe estado ja validado e aplica no grafo de audio com rampas suaves.
- `Config`: concentra constantes globais (rampas, filtros, limites e presets de modo).

## Politica de Volume Centralizada
- Beat: camada principal de referencia.
- Binaural: `mix <= beatVolume * 0.1` (state + engine).
- Noise: limitado por `maxNoiseMix`.
- Master: controle final de saida para evitar saturacao no dispositivo.

## Fluxo de Audio
```text
Binaural + Noise + Lofi -> Session Gain -> Compressor -> Master Gain -> Analyser -> Destination
```

## Como Rodar
1. Abra o projeto no VS Code.
2. Inicie com Live Server em `index.html`.
3. Use fones para perceber corretamente o efeito binaural.

## Roadmap Tecnico
- `v0.9`: presets de mix (`Beat Focus`, `Balanced`, `Meditation`).
- `v1.0`: sessoes guiadas (tempo, progressao, respiracao).
- `v1.1`: telemetria local anonima de uso de controles.
- `v1.2`: testes automatizados de estado e regressao de mix.
- `v1.3`: `dispose()` completo nas engines e limpeza de timers/nodes.
- `v1.4`: hard limiter apos compressor para zero clipping em cenario extremo.

## Notas
- O projeto prioriza suavidade auditiva e transicoes sem cliques.
- Alteracoes de volume/filtros devem usar rampas (`linearRampToValueAtTime` ou `exponentialRampToValueAtTime`).
