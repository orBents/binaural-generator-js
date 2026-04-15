const VIBES = {
  Delta: {
    label: "Delta",
    baseFrequency: 56,
    beatFrequency: 2,
    gradient: ["#1c2336", "#15202c"],
    accent: "#87c3ff",
    text: "#eaf4ff",
    muted: "#9fb3c9",
  },
  Theta: {
    label: "Theta",
    baseFrequency: 64,
    beatFrequency: 5,
    gradient: ["#1f2d2a", "#13231f"],
    accent: "#8bd8c9",
    text: "#edfef9",
    muted: "#98b8b0",
  },
  Alpha: {
    label: "Alpha",
    baseFrequency: 72,
    beatFrequency: 8,
    gradient: ["#2f2418", "#1f1710"],
    accent: "#f0b37d",
    text: "#fff2e8",
    muted: "#c6aa93",
  },
  Beta: {
    label: "Beta",
    baseFrequency: 86,
    beatFrequency: 14,
    gradient: ["#2d1f25", "#1a1116"],
    accent: "#ff8fa3",
    text: "#ffeef1",
    muted: "#c39aa5",
  },
};

const VIBE_KEYS = Object.keys(VIBES);

const MOOD_PRESETS = {
  relax: {
    label: "relax",
    vibe: "Delta",
    lofiMode: "nostalgic",
    globalBpm: 98,
    intensity: 0.46,
    volume: 0.78,
    grooveEnabled: true,
    vinylEnabled: true,
    timbre: "rhodes",
    pedalEnabled: true,
    harmonicMode: "dorian",
    progressionMotion: "fourths",
  },
  study: {
    label: "study",
    vibe: "Theta",
    lofiMode: "nostalgic",
    globalBpm: 102,
    intensity: 0.6,
    volume: 0.8,
    grooveEnabled: true,
    vinylEnabled: true,
    timbre: "blend",
    pedalEnabled: true,
    harmonicMode: "dorian",
    progressionMotion: "fifths",
  },
  aggressive: {
    label: "aggressive",
    vibe: "Beta",
    lofiMode: "nostalgic",
    globalBpm: 108,
    intensity: 0.78,
    volume: 0.88,
    grooveEnabled: true,
    vinylEnabled: false,
    timbre: "flute",
    pedalEnabled: false,
    harmonicMode: "lydian",
    progressionMotion: "fifths",
  },
  tense: {
    label: "tense",
    vibe: "Alpha",
    lofiMode: "nostalgic",
    globalBpm: 104,
    intensity: 0.7,
    volume: 0.84,
    grooveEnabled: true,
    vinylEnabled: true,
    timbre: "blend",
    pedalEnabled: false,
    harmonicMode: "lydian",
    progressionMotion: "fourths",
  },
};

function getVibe(name) {
  return VIBES[name] || VIBES.Alpha;
}

function getMoodPreset(name) {
  return MOOD_PRESETS[name] || MOOD_PRESETS.relax;
}

export { VIBES, VIBE_KEYS, MOOD_PRESETS, getVibe, getMoodPreset };
