// Cores do tema (pode ser usado no servidor e no navegador).

export const DEFAULT_COLOR = "#0f4c5c";

// Cores prontas para escolher nas configurações.
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Azul-petróleo", hex: "#0f4c5c" },
  { name: "Azul", hex: "#1d4ed8" },
  { name: "Índigo", hex: "#4f46e5" },
  { name: "Roxo", hex: "#7e22ce" },
  { name: "Vinho", hex: "#9f1239" },
  { name: "Laranja", hex: "#c2410c" },
  { name: "Verde", hex: "#15803d" },
  { name: "Grafite", hex: "#334155" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;

const mix = (a: number[], b: number[], t: number) => a.map((c, i) => c + (b[i] - c) * t);

// Variações da cor principal usadas no sistema (hover, fundo suave, texto).
export function themeVars(hex: string): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_COLOR;
  const rgb = hexToRgb(safe);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return [
    `--color-pen:${safe}`,
    `--color-pen-dark:${toHex(mix(rgb, black, 0.22))}`,
    `--color-pen-soft:${toHex(mix(rgb, white, 0.91))}`,
    `--color-pen-ink:${toHex(lum > 0.45 ? mix(rgb, black, 0.45) : rgb)}`,
  ].join(";");
}
