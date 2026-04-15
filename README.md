# BIWAVE / LOFI MAKER

PWA de foco e relaxamento que combina **binaural beats**, **groove lo-fi generativo** e **harmonia adaptativa** em uma interface mobile-first com fluxo progressivo (`Moods` -> `LOFI MAKER`).

## Sumario Executivo

`BIWAVE` resolve um problema comum de produtividade: iniciar um ambiente sonoro de concentracao sem friccao e sem precisar abrir DAW, playlist e app de ruido separadamente.

O produto oferece:

- Inicio rapido por humor/objetivo (Moods).
- Camada binaural sutil para suporte de foco/relaxamento.
- Beat/harmonia lo-fi com variacao organica e controles musicais.
- Execucao no navegador como PWA, com comportamento consistente em desktop e mobile.

Resultado pratico: menos carga cognitiva para montar "setup de estudo/trabalho" e mais continuidade de fluxo.

## Arquitetura do Sistema

### Visao Geral

```text
index.html
css/
  theme.css
src/
  app.js
  state.js
  config/audioConfig.mjs
  core/
    BinauralEngine.mjs
    LofiEngine.mjs
    BeatEngine.mjs
    PianoEngine.mjs
  ui/
    Visualizer.mjs
  utils/
    presets.mjs
```

### Core

- `BinauralEngine`: gera pares de osciladores L/R, ruido brown, filtros e compressor; controla mix binaural e master.
- `LofiEngine`: orquestra beat, piano e ruido de vinil; aplica regras musicais de intensidade/groove.
- `BeatEngine`: sequenciador por steps (8 passos) com swing, shuffle e laid-back.
- `PianoEngine`: harmonia/modal interchange, voicings, timbre e modulacao (wow/flutter + tape drift).

### UI

- `index.html`: estrutura das telas (Moods e Maker), controles de modulo e footer "now playing".
- `css/theme.css`: identidade visual Spotify Dark + responsividade mobile.
- `Visualizer.mjs`: osciloscopio/pulso reativo ao audio e ao piano.

### State

- `state.js`: estado central + `deepMerge` + subscribers.
- `audioConfig.mjs` (`applyAudioPolicy`): clamp de ranges, limites de seguranca e normalizacao de escolhas.

### Config

- Parametros de audio, envelopes/rampas, modos lo-fi, escalas e politicas de mix.

## Guia de Recursos (Deep Dive)

### Binaural Engine

Binaural beat = diferenca entre frequencias esquerda/direita:

- Exemplo: `72 Hz` (L) e `80 Hz` (R) -> batimento percebido de `8 Hz`.
- No app, esse offset e controlado por `Binaural Offset`.

Medidas de seguranca aplicadas:

- Mix binaural limitado dinamicamente a `10%` do volume de beat (`getMaxBinauralMix`).
- Clamp global de volume, noise mix e offset para evitar overdrive e fadiga.

Objetivo da implementacao: manter binaural como camada de suporte, nunca dominante.

### Rhythm & Groove

O groove nao e "grid 100% reto". O motor usa:

- `shuffle`: desloca offbeats.
- `laidBack`: atrasos sutis para "recuo" ritmico.
- `microJitter`: variacao minima aleatoria.

Estilos praticos:

- **Soft**: menor intensidade, menos densidade.
- **Jazzy/Drive**: mais notas fantasma, ghost hats e kick de apoio.

No codigo, a identidade ritmica e recalculada por intensidade e estado de groove.

### Harmonics & Scales

O bloco harmonico usa modos:

- `dorian`
- `lydian`

E movimento de progressao:

- `fourths` (quartas)
- `fifths` (quintas)

Sobre "campos harmonicos":

- Hoje o projeto implementa familias modais (dorian/lydian) com formulas de acorde.
- "Rap", "Prog" etc. podem ser adicionados como novos perfis em `PianoEngine.modeProfiles`.

Pedal (`pedalEnabled`):

- aumenta sustain/release,
- cola voicings,
- deixa a cama harmonica mais cinematica e continua.

### Experiencia UX

Design progressivo:

- Tela `Moods`: entrada rapida, baixa carga cognitiva.
- Tela `LOFI MAKER`: refinamento por modulo (Binaural, Ritmo, Ruido, Harmonia).

Diretrizes aplicadas:

- Mobile-first com tabs de modulo abaixo de `740px`.
- Controles tecnicos movidos para `Advanced Lab` (detalhes recolhiveis).
- Barra fixa de playback para controle constante.
- PWA com `manifest` + `service worker` (fora de localhost).

## Auditoria Tecnica (Resumo das melhorias aplicadas)

- Estado/playback: ao desligar todos os modulos, o playback e interrompido automaticamente (sem logica orfa).
- Politica de autoplay: reforco de `AudioContext.resume()` em interacao do usuario e retorno da aba.
- Integridade de tipo: ajustes de conversao numerica em sliders de timbre/filtro.
- Config centralizada: compressor do `BinauralEngine` agora usa defaults de `audioConfig`.
- Refino criativo: easter egg sonoro de fita no piano (micro drift de pitch ligado ao `Tape Hiss`).
- UX: reducao de poluicao visual movendo controles tecnicos para painel avancado recolhivel.

## Como Rodar

Como o projeto usa ES Modules, rode em servidor local:

```bash
python -m http.server 8080
```

Abra em seguida:

```text
http://localhost:8080
```

## Como Contribuir

1. Faca fork e crie uma branch (`feature/minha-melhoria`).
2. Mantenha padrao modular (`src/core`, `src/ui`, `src/state`, `src/config`).
3. Priorize mudancas pequenas e testaveis por modulo.
4. Para audio: valide clipping, volume relativo e transicoes de rampa.
5. Para UX: valide fluxo mobile e navegacao entre `Moods` e `Maker`.
6. Abra PR com:
   - objetivo da mudanca,
   - impacto sonoro/UX,
   - passos de reproducao.

## Roadmap Sugerido

- Novos perfis harmonicos (ex.: rap/prog/chillhop) em `modeProfiles`.
- Presets salvos por usuario (localStorage).
- Modo "session timer" com fades automaticos.
- Testes de regressao de estado/playback e smoke test de audio nodes.
