type IconProps = { className?: string; size?: number; strokeWidth?: number };

const P = (d: string, extra?: React.ReactNode) => (
  <>
    <path d={d} />
    {extra}
  </>
);

const PATHS: Record<string, React.ReactNode> = {
  play: P("M7 4.5v15l12-7.5-12-7.5Z"),
  pause: P("M8.5 5v14M15.5 5v14"),
  stop: P("M6.5 6.5h11v11h-11z"),
  volume: P("M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z", <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8" />),
  mute: P("M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z", <path d="m16 9.5 5 5m0-5-5 5" />),
  expand: P("M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"),
  collapse: P("M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4"),
  pip: P("M3.5 5.5h17v13h-17z", <rect x="12" y="11.5" width="6.5" height="5" fill="currentColor" stroke="none" rx="1" />),
  star: P("m12 4 2.5 5.2 5.6.8-4 4 .9 5.7-5-2.7-5 2.7.9-5.7-4-4 5.6-.8L12 4Z"),
  search: P("M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2 21 21"),
  sun: P(
    "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7",
  ),
  moon: P("M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"),
  menu: P("M4 7h16M4 12h16M4 17h10"),
  close: P("M6 6l12 12M18 6 6 18"),
  chevronDown: P("m6 9.5 6 6 6-6"),
  chevronRight: P("m9.5 5 7 7-7 7"),
  chevronLeft: P("m14.5 5-7 7 7 7"),
  sliders: P(
    "M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M8 14.5v5",
  ),
  refresh: P("M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"),
  grid: P("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
  list: P("M4 6.5h16M4 12h16M4 17.5h16"),
  calendar: P("M4 6.5h16v13H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4"),
  check: P("m5 12.5 4.5 4.5L19 7"),
  alert: P("M12 4.5 21 19.5H3L12 4.5ZM12 10v4M12 16.6v.4"),
  info: P("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.8v.4"),
  prev: P("M6 5.5v13M19 6.5 9.5 12 19 17.5v-11Z"),
  next: P("M18 5.5v13M5 6.5 14.5 12 5 17.5v-11Z"),
  signal: P(
    "M12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    <path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6M16.8 7.2a6.8 6.8 0 0 1 0 9.6M4.4 4.4a10.7 10.7 0 0 0 0 15.2M19.6 4.4a10.7 10.7 0 0 1 0 15.2" />,
  ),
  bolt: P("M13.5 3 5.5 13.5H11l-1 7.5 8.5-11H13l.5-7Z"),
  shield: P("M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6l7-2.5Z", <path d="m9.2 12 2 2 3.6-3.8" />),
  globe: P("M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM3.7 12h16.6M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5Z"),
  trash: P("M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6"),
  external: P("M14 4h6v6M20 4l-8.5 8.5M18 14v6H4V6h6"),
  heart: P("M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3c0 5-7.5 9.6-7.5 9.6Z"),
  copy: P("M9 9h11v11H9zM4 15V4h11"),
  keyboard: P(
    "M3 7h18v10H3zM6.5 10.5h.01M9.5 10.5h.01M12.5 10.5h.01M15.5 10.5h.01M18 10.5h.01M7.5 14h9",
  ),
  layers: P("m12 3.5 8.5 4.5-8.5 4.5L3.5 8l8.5-4.5ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5"),
  download: P("M12 4v10M8 11l4 4 4-4M5 19h14"),
  tv: P("M4 8h16v11H4zM8.5 4.5 12 8l3.5-3.5"),
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.7,
}: IconProps & { name: keyof typeof PATHS | string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.info}
    </svg>
  );
}

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pm-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--c-ember)" />
          <stop offset="100%" stopColor="var(--c-live)" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="4.4" fill="url(#pm-a)" />
      <path
        d="M11 11a12.7 12.7 0 0 0 0 18M29 11a12.7 12.7 0 0 1 0 18"
        fill="none"
        stroke="url(#pm-a)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M6.5 6.5a19 19 0 0 0 0 27M33.5 6.5a19 19 0 0 1 0 27"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
