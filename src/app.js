import { BinauralEngine } from "./core/BinauralEngine.mjs";
import { LofiEngine } from "./core/LofiEngine.mjs";
import { getMaxBinauralMix } from "./config/audioConfig.mjs";
import { PRESET_KEYS, getPreset } from "./utils/presets.mjs";
import { Visualizer } from "./ui/Visualizer.mjs";
import { createState } from "./state.js";

const appState = createState();
const initial = appState.getState();

const engine = new BinauralEngine({
  masterGain: initial.binaural.mix,
  masterVolume: initial.binaural.masterVolume,
});

const lofiEngine = new LofiEngine(engine.getAudioContext(), engine.getAtmosphereInputNode(), {
  intensity: initial.lofi.intensity,
  volume: initial.lofi.volume,
  vinylEnabled: initial.lofi.vinylEnabled,
  globalBpm: initial.lofi.globalBpm,
});

const btnPlay = document.getElementById("play-btn");
const presetSelect = document.getElementById("preset-select");
const waveTypeSelect = document.getElementById("wave-type");
const binauralMix = document.getElementById("binaural-mix");
const noiseMix = document.getElementById("noise-mix");
const masterVolume = document.getElementById("master-volume");
const globalBpm = document.getElementById("global-bpm");
const lofiVolume = document.getElementById("lofi-volume");
const lofiIntensity = document.getElementById("lofi-intensity");
const pianoTimbre = document.getElementById("piano-timbre");
const vinylToggle = document.getElementById("vinyl-toggle");
const grooveToggle = document.getElementById("groove-toggle");
const oscilloscopeCanvas = document.getElementById("oscilloscope");
const presetHint = document.getElementById("preset-hint");
const modulePanels = document.querySelectorAll(".module-panel");
const modeButtons = document.querySelectorAll(".mode-btn");
const binauralCapHint = document.getElementById("binaural-cap-hint");

const visualizer = new Visualizer(oscilloscopeCanvas, engine.getAnalyserNode());
visualizer.start();

lofiEngine.setOnPianoNote((event) => {
  const strength = Math.min(1.2, 0.45 + (event.frequency / 880) * 0.55);
  visualizer.triggerPianoPulse(strength);
});

function setupPresetOptions() {
  const fragment = document.createDocumentFragment();

  PRESET_KEYS.forEach((presetName) => {
    const option = document.createElement("option");
    option.value = presetName;
    option.textContent = presetName;
    option.selected = presetName === appState.getState().binaural.preset;
    fragment.appendChild(option);
  });

  presetSelect.innerHTML = "";
  presetSelect.appendChild(fragment);
}

function applyThemeFromPreset(presetName) {
  const preset = getPreset(presetName);
  presetHint.textContent = `${preset.label}: batimento ${preset.beatFrequency}Hz`;
}

function setActivePanel(panelName) {
  const isRhythm = panelName === "rhythm";
  document.body.dataset.activeTab = isRhythm ? "rhythm" : "tuning";
  visualizer.setStrokeColor(isRhythm ? "rgba(191, 168, 219, 0.9)" : "rgba(157, 137, 190, 0.9)");
}

function updateBinauralCapUI(state) {
  const cap = getMaxBinauralMix(state.lofi.volume);
  binauralMix.max = String(cap);
  binauralMix.title = `Limite atual: ${Math.round(cap * 100)}%`;

  if (binauralCapHint) {
    binauralCapHint.textContent = `Binaural limitado a ${Math.round(cap * 100)}% (10% do Beat)`;
  }
}

function syncControlsFromState(state) {
  presetSelect.value = state.binaural.preset;
  waveTypeSelect.value = state.binaural.waveType;
  binauralMix.value = String(state.binaural.mix);
  noiseMix.value = String(state.binaural.noiseMix);
  masterVolume.value = String(state.binaural.masterVolume);

  if (globalBpm) {
    globalBpm.value = String(state.lofi.globalBpm);
  }
  lofiVolume.value = String(state.lofi.volume);
  lofiIntensity.value = String(state.lofi.intensity);
  if (pianoTimbre) {
    pianoTimbre.value = state.lofi.pianoTimbre;
  }
  vinylToggle.checked = state.lofi.vinylEnabled;
  grooveToggle.checked = state.lofi.grooveEnabled;

  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.lofi.mode);
  });

  btnPlay.classList.toggle("paused", state.playback.isPlaying);
  btnPlay.setAttribute("aria-label", state.playback.isPlaying ? "Pausar reproducao" : "Iniciar reproducao");
}

function applyAudioState(state) {
  engine.setBeatReferenceVolume(state.lofi.volume);
  engine.setPreset(state.binaural.preset, 0);
  engine.setWaveType(state.binaural.waveType);
  engine.setBinauralMix(state.binaural.mix);
  engine.setNoiseMix(state.binaural.noiseMix);
  engine.setMasterVolume(state.binaural.masterVolume, 0);

  lofiEngine.setMode(state.lofi.mode, { immediate: true });
  lofiEngine.setGlobalBpm(state.lofi.globalBpm);
  lofiEngine.setVolume(state.lofi.volume, 0);
  lofiEngine.setIntensity(state.lofi.intensity);
  lofiEngine.setPianoTimbre(state.lofi.pianoTimbre);
  lofiEngine.setVinylEnabled(state.lofi.vinylEnabled);
  lofiEngine.setGrooveEnabled(state.lofi.grooveEnabled);

  applyThemeFromPreset(state.binaural.preset);
  setActivePanel("tuning");
}

setupPresetOptions();
syncControlsFromState(initial);
applyAudioState(initial);
updateBinauralCapUI(initial);

appState.subscribe((state) => {
  engine.setBeatReferenceVolume(state.lofi.volume);
  syncControlsFromState(state);
  applyThemeFromPreset(state.binaural.preset);
  updateBinauralCapUI(state);
});

presetSelect.addEventListener("change", (event) => {
  appState.setState({
    binaural: {
      preset: event.target.value,
    },
  });

  const next = appState.getState();
  engine.setPreset(next.binaural.preset, 3);
});

waveTypeSelect.addEventListener("change", (event) => {
  appState.setState({
    binaural: {
      waveType: event.target.value,
    },
  });

  engine.setWaveType(appState.getState().binaural.waveType);
});

binauralMix.addEventListener("input", (event) => {
  appState.setState({
    binaural: {
      mix: Number(event.target.value),
    },
  });

  engine.setBinauralMix(appState.getState().binaural.mix);
});

noiseMix.addEventListener("input", (event) => {
  appState.setState({
    binaural: {
      noiseMix: Number(event.target.value),
    },
  });

  engine.setNoiseMix(appState.getState().binaural.noiseMix);
});

masterVolume.addEventListener("input", (event) => {
  appState.setState({
    binaural: {
      masterVolume: Number(event.target.value),
    },
  });

  engine.setMasterVolume(appState.getState().binaural.masterVolume);
});

if (globalBpm) {
  globalBpm.addEventListener("input", (event) => {
    appState.setState({
      lofi: {
        globalBpm: Number(event.target.value),
      },
    });

    lofiEngine.setGlobalBpm(appState.getState().lofi.globalBpm);
  });
}

lofiVolume.addEventListener("input", (event) => {
  appState.setState({
    lofi: {
      volume: Number(event.target.value),
    },
  });

  const nextState = appState.getState();
  engine.setBeatReferenceVolume(nextState.lofi.volume);
  lofiEngine.setVolume(nextState.lofi.volume);
  engine.setBinauralMix(nextState.binaural.mix);
});

lofiIntensity.addEventListener("input", (event) => {
  appState.setState({
    lofi: {
      intensity: Number(event.target.value),
    },
  });

  lofiEngine.setIntensity(appState.getState().lofi.intensity);
});

if (pianoTimbre) {
  pianoTimbre.addEventListener("change", (event) => {
    appState.setState({
      lofi: {
        pianoTimbre: event.target.value,
      },
    });

    lofiEngine.setPianoTimbre(appState.getState().lofi.pianoTimbre);
  });
}

vinylToggle.addEventListener("change", (event) => {
  appState.setState({
    lofi: {
      vinylEnabled: event.target.checked,
    },
  });

  lofiEngine.setVinylEnabled(appState.getState().lofi.vinylEnabled);
});

grooveToggle.addEventListener("change", (event) => {
  appState.setState({
    lofi: {
      grooveEnabled: event.target.checked,
    },
  });

  lofiEngine.setGrooveEnabled(appState.getState().lofi.grooveEnabled);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActivePanel("rhythm");
    appState.setState({
      lofi: {
        mode: button.dataset.mode,
      },
    });

    lofiEngine.setMode(appState.getState().lofi.mode);
  });
});

modulePanels.forEach((panel) => {
  panel.addEventListener("toggle", () => {
    if (!panel.open) {
      return;
    }

    modulePanels.forEach((other) => {
      if (other !== panel && other.open) {
        other.open = false;
      }
    });

    setActivePanel(panel.dataset.panel || "tuning");
  });
});

btnPlay.addEventListener("click", async (event) => {
  event.preventDefault();

  const state = appState.getState();

  try {
    if (!state.playback.isPlaying) {
      await engine.start();
      await lofiEngine.start();
      appState.setState({
        playback: {
          isPlaying: true,
        },
      });
      return;
    }

    lofiEngine.stop();
    await engine.stopAll(0.35);
    appState.setState({
      playback: {
        isPlaying: false,
      },
    });
  } catch (error) {
    console.error("Falha ao alternar reproducao:", error);
  }
});

window.addEventListener("beforeunload", async () => {
  lofiEngine.stop();
  await engine.stopAll(0.2);
  visualizer.stop();
});
