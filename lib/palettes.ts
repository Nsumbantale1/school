export const PALETTES = [
  {
    id: "command",
    label: "Command",
    description: "Forest green & brass",
    swatches: ["#173a2c", "#2f6b4f", "#d6a64a"],
  },
  {
    id: "regimental",
    label: "Regimental",
    description: "Maroon & khaki",
    swatches: ["#4a0f1d", "#951f39", "#c9c09b"],
  },
  {
    id: "classic",
    label: "Classic",
    description: "Tanzania flag green & yellow",
    swatches: ["#1f5e33", "#1eb53a", "#fcd116"],
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const DEFAULT_PALETTE: PaletteId = "command";
export const PALETTE_STORAGE_KEY = "sofa-palette";

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

// Runs before first paint so the saved palette never flashes the default.
export const PALETTE_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  PALETTE_STORAGE_KEY
)});if(${JSON.stringify(PALETTES.map((p) => p.id))}.indexOf(p)>-1&&p!==${JSON.stringify(
  DEFAULT_PALETTE
)}){document.documentElement.setAttribute("data-palette",p);}}catch(e){}})();`;
