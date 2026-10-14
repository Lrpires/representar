import type { ReactNode } from "react";

// Ícones de traço (24×24), desenhados para combinar entre si.
const paths = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.25" />
      <path d="M3.5 19.5c.6-3 2.9-5 5.5-5s4.9 2 5.5 5" />
      <path d="M15.5 5.4a3.25 3.25 0 0 1 0 6.2M17.5 14.6c1.6.6 2.7 2.3 3 4.9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
    </>
  ),
  factory: (
    <>
      <path d="M3.5 20V10.5l5 3.2v-3.2l5 3.2V5.5h7V20z" />
      <path d="M2.5 20h19M7 17h1.5M11.5 17H13M16 17h1.5" />
    </>
  ),
  box: (
    <>
      <path d="M12 3.5 4 7.5v9l8 4 8-4v-9z" />
      <path d="M4 7.5 12 11.5l8-4M12 11.5v9" />
    </>
  ),
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
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m19.5 19.5-4.2-4.2" />
    </>
  ),
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  "chevrons-updown": <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  logout: <path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3.5M15.5 8l4 4-4 4M19.5 12H9.5" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-up-right": <path d="M7 17 17 7M8 7h9v9" />,
  percent: (
    <>
      <path d="M18.5 5.5l-13 13" />
      <circle cx="7.5" cy="7.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15.5" rx="2" />
      <path d="M4 9.5h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  phone: (
    <path d="M5.5 4h3.2l1.8 4.6-2.3 1.4a10.5 10.5 0 0 0 5.8 5.8l1.4-2.3 4.6 1.8v3.2A1.5 1.5 0 0 1 18.5 20 15 15 0 0 1 4 5.5 1.5 1.5 0 0 1 5.5 4z" />
  ),
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z" />
      <path d="M9.2 8.6c.2-.4.5-.5.8-.5h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.5.6c.6 1.1 1.4 1.9 2.5 2.5l.6-.5c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.4c0 .3-.1.6-.5.8-.6.4-1.5.5-2.5.1a8 8 0 0 1-4.3-4.3c-.4-1-.3-1.9.1-2.5z" />
    </>
  ),
  chat: <path d="M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H8.5z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20.5s6.5-5.8 6.5-10.5a6.5 6.5 0 1 0-13 0c0 4.7 6.5 10.5 6.5 10.5z" />
      <circle cx="12" cy="10" r="2.25" />
    </>
  ),
  file: (
    <>
      <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z" />
      <path d="M13.5 3.5v5h5M9 13h6M9 16.5h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.75v5M12 16.25v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.75v.01" />
    </>
  ),
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
  send: (
    <>
      <path d="M20.5 3.5 10 14" />
      <path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h11v10H3zM14 10h4l3 3.5v3h-7" />
      <circle cx="7" cy="17.5" r="1.75" />
      <circle cx="17.5" cy="17.5" r="1.75" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  settings: (
    <>
      <path d="M10.3 3.9a1.8 1.8 0 0 1 3.4 0l.3.8a1.8 1.8 0 0 0 2.4 1l.8-.4a1.8 1.8 0 0 1 2.4 2.4l-.4.8a1.8 1.8 0 0 0 1 2.4l.8.3a1.8 1.8 0 0 1 0 3.4l-.8.3a1.8 1.8 0 0 0-1 2.4l.4.8a1.8 1.8 0 0 1-2.4 2.4l-.8-.4a1.8 1.8 0 0 0-2.4 1l-.3.8a1.8 1.8 0 0 1-3.4 0l-.3-.8a1.8 1.8 0 0 0-2.4-1l-.8.4a1.8 1.8 0 0 1-2.4-2.4l.4-.8a1.8 1.8 0 0 0-1-2.4l-.8-.3a1.8 1.8 0 0 1 0-3.4l.8-.3a1.8 1.8 0 0 0 1-2.4l-.4-.8a1.8 1.8 0 0 1 2.4-2.4l.8.4a1.8 1.8 0 0 0 2.4-1z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
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
  more: (
    <>
      <circle cx="5.5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1" fill="currentColor" />
    </>
  ),
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
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.6,
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
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
