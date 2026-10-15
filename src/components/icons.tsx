import type { ReactNode } from "react";

// Ícones de traço (24×24) no desenho da marca: traço reto, junções em ângulo vivo, diagonais a 45°.
const paths = {
  home: <><path d="M3 11L12 4L21 11"/><path d="M5 9.5V20H19V9.5"/><path d="M10 20V14H14V20"/></>,
  users: <><path d="M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"/><path d="M2.5 20C2.5 15.8 5.4 13.5 9 13.5S15.5 15.8 15.5 20"/><path d="M16 5.2A3 3 0 0 1 16 11.3M18.2 14C20.3 14.8 21.5 16.8 21.5 20"/></>,
  user: <><path d="M8 8a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M4 21C4 16.5 7.5 14 12 14S20 16.5 20 21"/></>,
  factory: <><path d="M3 21H21"/><path d="M3 21V10L9 13V10L15 13V21"/><path d="M15 21V5H21V21"/></>,
  box: <><path d="M3 7L12 3L21 7V17L12 21L3 17Z"/><path d="M3 7L12 11L21 7"/><path d="M12 11V21"/></>,
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.4 6.4a1.5 1.5 0 0 1-2.1 0z" />
      <circle cx="8" cy="8" r="1.25" />
    </>
  ),
  bolt: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z" />,
  sparkle: (
    <path d="M12 3.5l1.6 4.9 4.9 1.6-4.9 1.6L12 16.5l-1.6-4.9L5.5 10l4.9-1.6zM18.5 15.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" />
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m20.5 15.5-4.5-4.5-8.5 8.5" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  plus: <><path d="M12 4V20"/><path d="M4 12H20"/></>,
  minus: <path d="M5 12h14" />,
  search: <><path d="M4 10.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0"/><path d="M15.5 15.5L21 21"/></>,
  x: <><path d="M5 5L19 19"/><path d="M19 5L5 19"/></>,
  "chevron-right": <><path d="M9 5L16 12L9 19"/></>,
  "chevron-left": <><path d="M15 5L8 12L15 19"/></>,
  "chevron-down": <><path d="M5 9L12 16L19 9"/></>,
  "chevrons-updown": <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  check: <><path d="M4 12.5L9.5 18L20 6.5"/></>,
  logout: <path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3.5M15.5 8l4 4-4 4M19.5 12H9.5" />,
  "arrow-left": <><path d="M20 12H4"/><path d="M10 6L4 12L10 18"/></>,
  "arrow-right": <><path d="M4 12H20"/><path d="M14 6L20 12L14 18"/></>,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  percent: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M15 9H10.8A1.9 1.9 0 0 0 10.8 12.8H13.2A1.9 1.9 0 0 1 13.2 16.6H9"/><path d="M12 6.5V9M12 16.6V18"/></>,
  calendar: <><path d="M3 5H21V21H3Z"/><path d="M3 10H21"/><path d="M8 3V7M16 3V7"/></>,
  phone: <><path d="M5 3H9L11 8L8.5 9.5A11 11 0 0 0 14.5 15.5L16 13L21 15V19A2 2 0 0 1 19 21A16 16 0 0 1 3 5A2 2 0 0 1 5 3Z"/></>,
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z" />
      <path d="M9.2 8.6c.2-.4.5-.5.8-.5h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.6-.5.8-.6.4-1.5.5-2.5.1a8 8 0 0 1-4.3-4.3c-.4-1-.3-1.9.1-2.5z" />
    </>
  ),
  chat: <path d="M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H8.5z" />,
  mail: <><path d="M3 5H21V19H3Z"/><path d="M3 5L12 13L21 5"/></>,
  pin: <><path d="M12 21C12 21 5 14.5 5 9.5A7 7 0 0 1 19 9.5C19 14.5 12 21 12 21Z"/><path d="M9.5 9.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/></>,
  file: <><path d="M6 3H14L19 8V21H6Z"/><path d="M14 3V8H19"/><path d="M9 13H16M9 17H13"/></>,
  receipt: <><path d="M5 3H19V21L15.5 19L12 21L8.5 19L5 21Z"/><path d="M9 8H15"/><path d="M9 12H15"/></>,
  alert: <><path d="M12 3L22 20H2Z"/><path d="M12 10V14M12 16.5V18"/></>,
  info: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 11V17M12 7V8.5"/></>,
  edit: (
    <>
      <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z" />
      <path d="m14 8 2 2" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.1" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  send: <><path d="M3 11L21 3L14 21L11 13Z"/><path d="M11 13L21 3"/></>,
  truck: <><path d="M2 6H14V16H2Z"/><path d="M14 10H18L22 14V16H14"/><path d="M4 18.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M15 18.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></>,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: <><path d="M4 7H11M15 7H20M4 17H6M10 17H20"/><path d="M11 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></>,
  target: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/></>,
  wallet: (
    <>
      <path d="M19.5 8V6.5A1.5 1.5 0 0 0 18 5H6a2 2 0 0 0 0 4h13.5v9.5A1.5 1.5 0 0 1 18 20H6a2 2 0 0 1-2-2V7" />
      <path d="M16 14.5h.01" />
    </>
  ),
  kanban: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
      <rect x="15.5" y="4" width="5" height="7" rx="1.5" />
    </>
  ),
  download: <path d="M12 4.5v11M7.5 11 12 15.5 16.5 11M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />,
  upload: <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V4h10v4.5M7 16H5a1.5 1.5 0 0 1-1.5-1.5v-4.5A1.5 1.5 0 0 1 5 8.5h14a1.5 1.5 0 0 1 1.5 1.5v4.5A1.5 1.5 0 0 1 19 16h-2" />
      <path d="M7 13.5h10V20H7z" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/></>,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16 12 20.5 20.5 16" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v5.5c0 4.3 3 7.8 7 9 4-1.2 7-4.7 7-9V6z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.5 3.4 5.3 3.4 8.5s-1.1 6-3.4 8.5c-2.3-2.5-3.4-5.3-3.4-8.5S9.7 6 12 3.5z" />
    </>
  ),
  cake: (
    <>
      <path d="M4.5 20.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7M3 20.5h18" />
      <path d="M4.5 15.5c1.3 0 1.3 1 2.5 1s1.3-1 2.5-1 1.3 1 2.5 1 1.3-1 2.5-1 1.3 1 2.5 1 1.3-1 2.5-1M12 12V8.5" />
      <path d="M12 4.5c.8.8.8 1.8 0 2.5-.8-.7-.8-1.7 0-2.5z" />
    </>
  ),
  logo: (
    <>
      <path d="M5 19V6.5A1.5 1.5 0 0 1 6.5 5H13a4 4 0 0 1 0 8H5" />
      <path d="m12 13 6 6" />
    </>
  ),
  avancar: <><path d="M4 6L10 12L4 18"/><path d="M12 6L18 12L12 18"/></>,
  vendas: <><path d="M3 20H21"/><path d="M4 16L9 11L13 14L20 6"/><path d="M15 6H20V11"/></>,
  aviso: <><path d="M6 17V10.5A6 6 0 0 1 18 10.5V17"/><path d="M4 17H20"/><path d="M10 20.5H14"/></>,
  compartilhar: <><path d="M3.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M15.5 6a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M15.5 18a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/><path d="M8.3 10.8L15.7 7.2M8.3 13.2L15.7 16.8"/></>,
  filtro: <><path d="M3 5H21L14 13V20L10 18V13Z"/></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
