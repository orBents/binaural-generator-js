const PRESETS = {
  Delta: {
    label: "Delta",
    baseFrequency: 56,
    beatFrequency: 2,
    gradient: ["#1a1230", "#2b1d4a"],
    accent: "#b693ff",
  },
  Theta: {
    label: "Theta",
    baseFrequency: 64,
    beatFrequency: 5,
    gradient: ["#22153b", "#3b2560"],
    accent: "#c2a6ff",
  },
  Alpha: {
    label: "Alpha",
    baseFrequency: 72,
    beatFrequency: 8,
    gradient: ["#2b1843", "#4a2a70"],
    accent: "#d5b8ff",
  },
  Beta: {
    label: "Beta",
    baseFrequency: 86,
    beatFrequency: 14,
    gradient: ["#361f53", "#5d3388"],
    accent: "#e3c8ff",
  },
};

const PRESET_KEYS = Object.keys(PRESETS);

function getPreset(name) {
  return PRESETS[name] || PRESETS.Alpha;
}

export { PRESETS, PRESET_KEYS, getPreset };
