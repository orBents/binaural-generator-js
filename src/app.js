import { BinauralEngine } from "./core/BinauralEngine.mjs";
import { LofiEngine } from "./core/LofiEngine.mjs";
import { getMaxBinauralMix } from "./config/audioConfig.mjs";
import { VIBE_KEYS, getVibe, getMoodPreset } from "./utils/presets.mjs";
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
  grooveEnabled: initial.lofi.grooveEnabled,
  pedalEnabled: initial.lofi.pedalEnabled,
  globalBpm: initial.lofi.globalBpm,
  timbre: initial.lofi.timbre,
  harmonicMode: initial.lofi.harmonicMode,
  progressionMotion: initial.lofi.progressionMotion,
  kickBody: initial.lofi.kickBody,
  snareClap: initial.lofi.snareClap,
  hatMotion: initial.lofi.hatMotion,
  tapeHiss: initial.lofi.tapeHiss,
  bassMode: initial.lofi.bassMode,
  wowFlutter: initial.lofi.wowFlutter,
  toneCutoff: initial.lofi.toneCutoff,
  resonance: initial.lofi.resonance,
  warmth: initial.lofi.warmth,
  space: initial.lofi.space,
  subOctaveEnabled: initial.lofi.subOctaveEnabled,
});

const body = document.body;
const playBtn = document.getElementById("play-btn");
const closeMakerBtn = document.getElementById("close-maker");
const openMakerBtn = document.getElementById("open-maker");
const vibeHint = document.getElementById("vibe-hint");
const moduleTabs = document.querySelectorAll(".module-tab");

const moodButtons = document.querySelectorAll(".mood-card");

const vibeSelect = document.getElementById("vibe-select");
const waveTypeSelect = document.getElementById("wave-type");
const binauralOffset = document.getElementById("binaural-offset");
const binauralMix = document.getElementById("binaural-mix");
const noiseMix = document.getElementById("noise-mix");
const binauralCapHint = document.getElementById("binaural-cap-hint");

const masterVolume = document.getElementById("master-volume");
const masterVolumeValue = document.getElementById("master-volume-value");
const globalBpm = document.getElementById("global-bpm");
const globalBpmValue = document.getElementById("global-bpm-value");
const lofiVolume = document.getElementById("lofi-volume");
const lofiIntensity = document.getElementById("lofi-intensity");
const kickBodyControl = document.getElementById("kick-body-control");
const snareClapControl = document.getElementById("snare-clap-control");
const hatMotionSelect = document.getElementById("hat-motion-select");
const rhythmBassMode = document.getElementById("rhythm-bass-mode");
const vinylToggle = document.getElementById("vinyl-toggle");
const grooveToggle = document.getElementById("groove-toggle");
const tapeHissControl = document.getElementById("tape-hiss-control");

const harmonicModeSelect = document.getElementById("harmonic-mode");
const progressionMotionSelect = document.getElementById("progression-motion");
const timbreSelect = document.getElementById("timbre-select");
const pedalToggle = document.getElementById("pedal-toggle");
const toneCutoffControl = document.getElementById("tone-cutoff-control");
const wowFlutterControl = document.getElementById("wow-flutter-control");
const resonanceControl = document.getElementById("resonance-control");
const warmthControl = document.getElementById("warmth-control");
const spaceControl = document.getElementById("space-control");
const suboctaveToggle = document.getElementById("suboctave-toggle");

const binauralEnabled = document.getElementById("binaural-enabled");
const rhythmEnabled = document.getElementById("rhythm-enabled");
const harmonicsEnabled = document.getElementById("harmonics-enabled");
const noiseEnabled = document.getElementById("noise-enabled");

const oscilloscopeCanvas = document.getElementById("oscilloscope");
const visualizer = new Visualizer(oscilloscopeCanvas, engine.getAnalyserNode());
visualizer.start();

lofiEngine.setOnPianoNote((event) => {
  const strength = Math.min(1.2, 0.42 + (event.frequency / 880) * 0.55);
  visualizer.triggerPianoPulse(strength);
});

function getModuleState(name) {
  const modules = appState.getState().ui.modules || {};
  return modules[name] !== false;
}

function getFirstEnabledModule(state) {
  const order = ["binaural", "rhythm", "noise", "harmonics"];
  const modules = state.ui.modules || {};
  return order.find((name) => modules[name] !== false) || "binaural";
}

function setActiveModule(name) {
  const state = appState.getState();
  if (!getModuleState(name)) {
    return;
  }
  if (state.ui.activeModule === name) {
    return;
  }

  appState.setState({
    ui: {
      activeModule: name,
    },
  });
}

function setView(view) {
  body.dataset.view = view;
  appState.setState({
    ui: {
      level: view === "control" ? "advanced" : "simple",
    },
  });
}

function setupVibeOptions() {
  const fragment = document.createDocumentFragment();
  VIBE_KEYS.forEach((vibeName) => {
    const option = document.createElement("option");
    option.value = vibeName;
    option.textContent = vibeName;
    fragment.appendChild(option);
  });
  vibeSelect.innerHTML = "";
  vibeSelect.appendChild(fragment);
}

function applyThemeFromVibe(vibeName) {
  const vibe = getVibe(vibeName);
  const state = appState.getState();

  vibeHint.textContent = `${vibe.label} - batimento ${state.binaural.offsetHz.toFixed(1)}Hz`;

  const root = document.documentElement;
  root.style.setProperty("--accent", vibe.accent || "#1db954");
  root.style.setProperty("--grad-a", vibe.gradient?.[0] || "#1e1e1e");
  root.style.setProperty("--grad-b", vibe.gradient?.[1] || "#151515");
  root.style.setProperty("--text", vibe.text || "#f5f5f5");
  root.style.setProperty("--muted", vibe.muted || "#a7a7a7");

  visualizer.setStrokeColor(`${vibe.accent || "#1db954"}dd`);
}

function setModuleUi(name, enabled) {
  const card = document.querySelector(`.module-card[data-module="${name}"]`);
  if (!card) {
    return;
  }

  card.classList.toggle("is-off", !enabled);
  card.querySelectorAll("select, input, button").forEach((element) => {
    if (element.id === `${name}-enabled`) {
      return;
    }
    element.disabled = !enabled;
  });
}

function updateBinauralCapUI(state) {
  const cap = getMaxBinauralMix(state.lofi.volume);
  binauralMix.max = String(cap);
  binauralCapHint.textContent = `Binaural limitado a ${Math.round(cap * 100)}% (10% do Beat)`;
}

function syncControlsFromState(state) {
  vibeSelect.value = state.binaural.vibe;
  waveTypeSelect.value = state.binaural.waveType;
  binauralOffset.value = String(state.binaural.offsetHz);
  binauralMix.value = String(state.binaural.mix);
  noiseMix.value = String(state.binaural.noiseMix);

  masterVolume.value = String(state.binaural.masterVolume);
  masterVolumeValue.textContent = `${Math.round(state.binaural.masterVolume * 100)}%`;

  globalBpm.value = String(state.lofi.globalBpm);
  globalBpmValue.textContent = `${Math.round(state.lofi.globalBpm)} BPM`;
  lofiVolume.value = String(state.lofi.volume);
  lofiIntensity.value = String(state.lofi.intensity);
  kickBodyControl.value = String(state.lofi.kickBody);
  snareClapControl.value = String(state.lofi.snareClap);
  hatMotionSelect.value = state.lofi.hatMotion;
  rhythmBassMode.value = state.lofi.bassMode;
  vinylToggle.checked = state.lofi.vinylEnabled;
  grooveToggle.checked = state.lofi.grooveEnabled;
  tapeHissControl.value = String(state.lofi.tapeHiss);

  harmonicModeSelect.value = state.lofi.harmonicMode;
  progressionMotionSelect.value = state.lofi.progressionMotion;
  timbreSelect.value = state.lofi.timbre;
  pedalToggle.checked = state.lofi.pedalEnabled;
  toneCutoffControl.value = String(state.lofi.toneCutoff);
  wowFlutterControl.value = String(state.lofi.wowFlutter);
  resonanceControl.value = String(state.lofi.resonance);
  warmthControl.value = String(state.lofi.warmth);
  spaceControl.value = String(state.lofi.space);
  suboctaveToggle.checked = state.lofi.subOctaveEnabled;

  moodButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mood === state.ui.mood);
  });

  binauralEnabled.checked = getModuleState("binaural");
  rhythmEnabled.checked = getModuleState("rhythm");
  harmonicsEnabled.checked = getModuleState("harmonics");
  noiseEnabled.checked = getModuleState("noise");

  setModuleUi("binaural", binauralEnabled.checked);
  setModuleUi("rhythm", rhythmEnabled.checked);
  setModuleUi("harmonics", harmonicsEnabled.checked);
  setModuleUi("noise", noiseEnabled.checked);

  const activeModule = getModuleState(state.ui.activeModule)
    ? state.ui.activeModule
    : getFirstEnabledModule(state);
  body.dataset.activeModule = activeModule;
  moduleTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.moduleTab === activeModule);
  });
  document.querySelectorAll(".module-card").forEach((card) => {
    card.classList.toggle("is-mobile-active", card.dataset.module === activeModule);
  });

  playBtn.classList.toggle("paused", state.playback.isPlaying);
  body.dataset.playing = state.playback.isPlaying ? "true" : "false";

  updateBinauralCapUI(state);
  applyThemeFromVibe(state.binaural.vibe);
}

function applyAudioState(state) {
  const binauralOn = getModuleState("binaural");
  const rhythmOn = getModuleState("rhythm");
  const harmonicsOn = getModuleState("harmonics");
  const noiseOn = getModuleState("noise");

  engine.setBeatReferenceVolume(state.lofi.volume);
  engine.setVibe(state.binaural.vibe, 0.25);
  engine.setBinauralOffset(state.binaural.offsetHz, 0.25);
  engine.setWaveType(state.binaural.waveType);
  engine.setBinauralMix(binauralOn ? state.binaural.mix : 0);
  engine.setNoiseMix(binauralOn && noiseOn ? state.binaural.noiseMix : 0);
  engine.setMasterVolume(state.binaural.masterVolume, 0.2);

  lofiEngine.setMode(state.lofi.mode, { immediate: true });
  lofiEngine.setGlobalBpm(state.lofi.globalBpm);
  lofiEngine.setVolume(state.lofi.volume, 0.2);
  lofiEngine.setIntensity(state.lofi.intensity);
  lofiEngine.setVinylEnabled(noiseOn ? state.lofi.vinylEnabled : false);
  lofiEngine.setGrooveEnabled(state.lofi.grooveEnabled);
  lofiEngine.setRhythmEnabled(rhythmOn);
  lofiEngine.setKickBody(state.lofi.kickBody);
  lofiEngine.setSnareClap(state.lofi.snareClap);
  lofiEngine.setHatMotion(state.lofi.hatMotion);
  lofiEngine.setBassMode(state.lofi.bassMode);
  lofiEngine.setTapeHiss(noiseOn ? state.lofi.tapeHiss : 0);

  lofiEngine.setHarmonicsEnabled(harmonicsOn);
  lofiEngine.setHarmonicMode(state.lofi.harmonicMode);
  lofiEngine.setProgressionMotion(state.lofi.progressionMotion);
  lofiEngine.setTimbre(state.lofi.timbre);
  lofiEngine.setPedalEnabled(state.lofi.pedalEnabled);
  lofiEngine.setToneCutoff(state.lofi.toneCutoff);
  lofiEngine.setWowFlutter(state.lofi.wowFlutter);
  lofiEngine.setResonance(state.lofi.resonance);
  lofiEngine.setWarmth(state.lofi.warmth);
  lofiEngine.setSpace(state.lofi.space);
  lofiEngine.setSubOctaveEnabled(state.lofi.subOctaveEnabled);
}

async function ensurePlaying() {
  const state = appState.getState();
  if (state.playback.isPlaying) {
    return;
  }

  await engine.start();
  await lofiEngine.start();
  appState.setState({
    playback: {
      isPlaying: true,
    },
  });
}

function patchModule(name, enabled) {
  const stateBefore = appState.getState();
  const shouldSwitchActive = !enabled && stateBefore.ui.activeModule === name;
  appState.setState({
    ui: {
      activeModule: shouldSwitchActive ? getFirstEnabledModule({
        ...stateBefore,
        ui: {
          ...stateBefore.ui,
          modules: {
            ...stateBefore.ui.modules,
            [name]: enabled,
          },
        },
      }) : stateBefore.ui.activeModule,
      modules: {
        [name]: enabled,
      },
    },
  });

  applyAudioState(appState.getState());
}

function applyMoodPreset(mood) {
  const moodPreset = getMoodPreset(mood);
  const vibe = getVibe(moodPreset.vibe);

  appState.setState({
    ui: {
      mood,
    },
    binaural: {
      vibe: moodPreset.vibe,
      offsetHz: vibe.beatFrequency,
    },
    lofi: {
      mode: moodPreset.lofiMode,
      globalBpm: moodPreset.globalBpm,
      intensity: moodPreset.intensity,
      volume: moodPreset.volume,
      grooveEnabled: moodPreset.grooveEnabled,
      vinylEnabled: moodPreset.vinylEnabled,
      timbre: moodPreset.timbre,
      pedalEnabled: moodPreset.pedalEnabled,
      harmonicMode: moodPreset.harmonicMode || "dorian",
      progressionMotion: moodPreset.progressionMotion || "fourths",
      hatMotion: moodPreset.hatMotion || "sixteenth",
      bassMode: moodPreset.bassMode || "warm",
      kickBody: moodPreset.kickBody ?? 0.6,
      snareClap: moodPreset.snareClap ?? 0.25,
      tapeHiss: moodPreset.tapeHiss ?? 0.3,
      wowFlutter: moodPreset.wowFlutter ?? 0.35,
      toneCutoff: moodPreset.toneCutoff ?? 1200,
    },
  });

  applyAudioState(appState.getState());
}

function formatRangeValue(input) {
  const id = input.id;
  const value = Number(input.value);

  if (id === "global-bpm") {
    return `${Math.round(value)} BPM`;
  }
  if (id === "tone-cutoff-control") {
    return `${Math.round(value)} Hz`;
  }
  if (id === "binaural-offset") {
    return `${value.toFixed(1)} Hz`;
  }
  if (id === "noise-mix" || id === "binaural-mix") {
    return `${Math.round(value * 100)}%`;
  }

  return value.toFixed(2);
}

function syncRangeReadouts() {
  document.querySelectorAll(".range-readout[data-range-value-for]").forEach((readout) => {
    const inputId = readout.dataset.rangeValueFor;
    const input = document.getElementById(inputId);
    if (!input) {
      return;
    }
    readout.textContent = formatRangeValue(input);
  });
}

setupVibeOptions();
applyMoodPreset(initial.ui.mood);
syncControlsFromState(appState.getState());

appState.subscribe((state) => {
  syncControlsFromState(state);
  syncRangeReadouts();
});

syncRangeReadouts();

openMakerBtn.addEventListener("click", () => {
  setView("control");
  const state = appState.getState();
  if (!getModuleState(state.ui.activeModule)) {
    setActiveModule(getFirstEnabledModule(state));
  }
});

closeMakerBtn.addEventListener("click", () => {
  setView("moods");
});

moodButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      applyMoodPreset(button.dataset.mood);
      await ensurePlaying();
    } catch (error) {
      console.error("Falha ao iniciar mood:", error);
    }
  });
});

vibeSelect.addEventListener("change", (event) => {
  const vibe = getVibe(event.target.value);
  appState.setState({
    binaural: {
      vibe: event.target.value,
      offsetHz: vibe.beatFrequency,
    },
  });

  const state = appState.getState();
  applyAudioState(state);
});

waveTypeSelect.addEventListener("change", (event) => {
  appState.setState({ binaural: { waveType: event.target.value } });
  engine.setWaveType(event.target.value);
});

binauralOffset.addEventListener("input", (event) => {
  appState.setState({ binaural: { offsetHz: Number(event.target.value) } });
  engine.setBinauralOffset(appState.getState().binaural.offsetHz, 0.25);
  applyThemeFromVibe(appState.getState().binaural.vibe);
});

binauralMix.addEventListener("input", (event) => {
  appState.setState({ binaural: { mix: Number(event.target.value) } });
  if (getModuleState("binaural")) {
    engine.setBinauralMix(appState.getState().binaural.mix);
  }
});

noiseMix.addEventListener("input", (event) => {
  appState.setState({ binaural: { noiseMix: Number(event.target.value) } });
  if (getModuleState("binaural") && getModuleState("noise")) {
    engine.setNoiseMix(appState.getState().binaural.noiseMix);
  }
});

masterVolume.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  appState.setState({ binaural: { masterVolume: value } });
  masterVolumeValue.textContent = `${Math.round(value * 100)}%`;
  engine.setMasterVolume(value);
});

globalBpm.addEventListener("input", (event) => {
  appState.setState({ lofi: { globalBpm: Number(event.target.value) } });
  globalBpmValue.textContent = `${Math.round(Number(event.target.value))} BPM`;
  lofiEngine.setGlobalBpm(appState.getState().lofi.globalBpm);
});

lofiVolume.addEventListener("input", (event) => {
  appState.setState({ lofi: { volume: Number(event.target.value) } });
  const state = appState.getState();
  engine.setBeatReferenceVolume(state.lofi.volume);
  lofiEngine.setVolume(state.lofi.volume);
  if (getModuleState("binaural")) {
    engine.setBinauralMix(state.binaural.mix);
  }
});

lofiIntensity.addEventListener("input", (event) => {
  appState.setState({ lofi: { intensity: Number(event.target.value) } });
  lofiEngine.setIntensity(appState.getState().lofi.intensity);
});

kickBodyControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { kickBody: Number(event.target.value) } });
  lofiEngine.setKickBody(appState.getState().lofi.kickBody);
});

snareClapControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { snareClap: Number(event.target.value) } });
  lofiEngine.setSnareClap(appState.getState().lofi.snareClap);
});

hatMotionSelect.addEventListener("change", (event) => {
  appState.setState({ lofi: { hatMotion: event.target.value } });
  lofiEngine.setHatMotion(appState.getState().lofi.hatMotion);
});

rhythmBassMode.addEventListener("change", (event) => {
  appState.setState({ lofi: { bassMode: event.target.value } });
  lofiEngine.setBassMode(appState.getState().lofi.bassMode);
});

vinylToggle.addEventListener("change", (event) => {
  appState.setState({ lofi: { vinylEnabled: event.target.checked } });
  if (getModuleState("noise")) {
    lofiEngine.setVinylEnabled(event.target.checked);
  }
});

grooveToggle.addEventListener("change", (event) => {
  appState.setState({ lofi: { grooveEnabled: event.target.checked } });
  lofiEngine.setGrooveEnabled(event.target.checked);
});

tapeHissControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { tapeHiss: Number(event.target.value) } });
  if (getModuleState("noise")) {
    lofiEngine.setTapeHiss(appState.getState().lofi.tapeHiss);
  }
});

harmonicModeSelect.addEventListener("change", (event) => {
  appState.setState({ lofi: { harmonicMode: event.target.value } });
  lofiEngine.setHarmonicMode(event.target.value);
});

progressionMotionSelect.addEventListener("change", (event) => {
  appState.setState({ lofi: { progressionMotion: event.target.value } });
  lofiEngine.setProgressionMotion(event.target.value);
});

timbreSelect.addEventListener("change", (event) => {
  appState.setState({ lofi: { timbre: event.target.value } });
  lofiEngine.setTimbre(event.target.value);
});

pedalToggle.addEventListener("change", (event) => {
  appState.setState({ lofi: { pedalEnabled: event.target.checked } });
  lofiEngine.setPedalEnabled(event.target.checked);
});

toneCutoffControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { toneCutoff: Number(event.target.value) } });
  lofiEngine.setToneCutoff(appState.getState().lofi.toneCutoff);
});

wowFlutterControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { wowFlutter: Number(event.target.value) } });
  lofiEngine.setWowFlutter(appState.getState().lofi.wowFlutter);
});

resonanceControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { resonance: Number(event.target.value) } });
  lofiEngine.setResonance(event.target.value);
});

warmthControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { warmth: Number(event.target.value) } });
  lofiEngine.setWarmth(event.target.value);
});

spaceControl.addEventListener("input", (event) => {
  appState.setState({ lofi: { space: Number(event.target.value) } });
  lofiEngine.setSpace(event.target.value);
});

suboctaveToggle.addEventListener("change", (event) => {
  appState.setState({ lofi: { subOctaveEnabled: event.target.checked } });
  lofiEngine.setSubOctaveEnabled(event.target.checked);
});

binauralEnabled.addEventListener("change", (event) => patchModule("binaural", event.target.checked));
rhythmEnabled.addEventListener("change", (event) => patchModule("rhythm", event.target.checked));
harmonicsEnabled.addEventListener("change", (event) => patchModule("harmonics", event.target.checked));
noiseEnabled.addEventListener("change", (event) => patchModule("noise", event.target.checked));

moduleTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveModule(button.dataset.moduleTab);
  });
});

playBtn.addEventListener("click", async (event) => {
  event.preventDefault();

  const state = appState.getState();

  try {
    if (!state.playback.isPlaying) {
      await ensurePlaying();
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
