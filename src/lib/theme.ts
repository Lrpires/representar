// Cores do tema (pode ser usado no servidor e no navegador).

// Cor da empresa: é ela que pinta a ação principal, os destaques, as barras de meta e o menu.
// Sem escolha, vale o laranja da marca Representar.
export const DEFAULT_COLOR = "#ff5b22";

// Cores padrão de versões antigas: quem nunca trocou passa a usar a da marca nova.
const LEGACY_DEFAULTS = ["#0f4c5c"];

// Cores prontas para escolher nas configurações.
export const COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: "Laranja (padrão)", hex: "#ff5b22" },
  { name: "Azul", hex: "#1d4ed8" },
  { name: "Índigo", hex: "#4f46e5" },
  { name: "Roxo", hex: "#7e22ce" },
  { name: "Vinho", hex: "#9f1239" },
  { name: "Verde", hex: "#15803d" },
  { name: "Petróleo", hex: "#0f3d3e" },
  { name: "Grafite", hex: "#15171c" },
];

// Cor salva pelo escritório, já tratando as cores padrão antigas.
export function orgColor(saved: string | null | undefined): string {
  const c = (saved ?? "").toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c) || LEGACY_DEFAULTS.includes(c)) return DEFAULT_COLOR;
  return c;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) =>
  `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;

const mix = (a: number[], b: number[], t: number) => a.map((c, i) => c + (b[i] - c) * t);

// Luminância relativa (WCAG), para escolher o texto que fica legível sobre a cor.
function luminance([r, g, b]: number[]) {
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const PAPER = [243, 240, 232];
const INK = [21, 23, 28];
const CARD_NIGHT = [30, 33, 40];

// Texto sobre a cor: grafite ou papel, o que tiver mais contraste (no laranja, grafite).
function onColor(rgb: number[]) {
  const l = luminance(rgb);
  return contrast(l, luminance(INK)) >= contrast(l, luminance(PAPER)) ? "#15171c" : "#f3f0e8";
}

// Variações da cor da empresa usadas no sistema (hover, fundo suave, texto colorido).
export function themeVars(hex: string): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_COLOR;
  const rgb = hexToRgb(safe);
  const l = luminance(rgb);
  // Cores muito escuras clareiam no hover; as demais escurecem.
  const hover = l < 0.03 ? mix(rgb, PAPER, 0.16) : mix(rgb, INK, 0.14);
  // Texto colorido precisa ler bem sobre o papel: escurece cores claras.
  const ink = contrast(l, luminance(PAPER)) >= 4.5 ? rgb : mix(rgb, INK, 0.35);
  return [
    `--color-accent:${safe}`,
    `--color-accent-dark:${toHex(hover)}`,
    `--color-accent-soft:${toHex(mix(rgb, PAPER, 0.82))}`,
    `--color-accent-ink:${toHex(ink)}`,
    `--color-on-accent:${onColor(rgb)}`,
  ].join(";");
}

// Mesmas variações para o tema noite: cores escuras clareiam para aparecer no fundo escuro.
export function themeVarsNight(hex: string): string {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : DEFAULT_COLOR;
  const rgb = hexToRgb(safe);
  const l = luminance(rgb);
  const base = l < 0.06 ? mix(rgb, PAPER, l < 0.03 ? 0.85 : 0.35) : rgb;
  return [
    `--color-accent:${toHex(base)}`,
    `--color-accent-dark:${toHex(mix(base, PAPER, 0.15))}`,
    `--color-accent-soft:${toHex(mix(base, CARD_NIGHT, 0.8))}`,
    `--color-accent-ink:${toHex(mix(base, PAPER, 0.35))}`,
    `--color-on-accent:${onColor(base)}`,
  ].join(";");
}

// CSS completo da cor do escritório (dia e noite), para o <style> do layout.
export function themeCss(hex: string): string {
  return `:root{${themeVars(hex)}}:root[data-theme="noite"]{${themeVarsNight(hex)}}`;
}
