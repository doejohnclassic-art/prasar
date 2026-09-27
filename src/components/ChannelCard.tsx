import { memo, useState } from "react";
import { Icon } from "./Icons";
import { hueOf, initials, languageName, type Channel } from "../lib/playlist";

export const LogoTile = memo(function LogoTile({
  channel,
  size = "md",
  rounded = "rounded-lg",
}: {
  channel: Channel;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dims = {
    xs: "h-7 w-7 text-[9px]",
    sm: "h-9 w-9 text-[10px]",
    md: "h-11 w-11 text-[12px]",
    lg: "h-16 w-16 text-[16px]",
  }[size];
  const hue = hueOf(channel.name);
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-line bg-surface2 ${rounded} ${dims}`}
    >
      {channel.logo && !failed ? (
        <img
          src={channel.logo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-[18%] mix-blend-normal"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center font-mono font-semibold tracking-tight text-white/90"
          style={{ background: `linear-gradient(150deg, hsl(${hue} 62% 30%), hsl(${(hue + 40) % 360} 55% 18%))` }}
        >
          {initials(channel.name)}
        </span>
      )}
    </span>
  );
});

type Props = {
  channel: Channel;
  active: boolean;
  favorite: boolean;
  view: "grid" | "list";
  onSelect: (c: Channel) => void;
  onToggleFavorite: (c: Channel) => void;
};

function ChannelCardBase({ channel, active, favorite, view, onSelect, onToggleFavorite }: Props) {
  const lang = channel.languages[0] ? languageName(channel.languages[0]) : null;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(channel);
  };

  if (view === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(channel)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(channel);
          }
        }}
        className={`reveal group relative flex cursor-pointer items-center gap-3 border-b border-linesoft px-3 py-2.5 transition-colors ${
          active ? "bg-ember/8" : "hover:bg-surface2"
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-[3px] transition-all ${
            active ? "bg-ember" : "bg-transparent group-hover:bg-line"
          }`}
        />
        <LogoTile channel={channel} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[13.5px] font-semibold ${active ? "text-ember" : "text-ink"}`}>{channel.name}</p>
          <p className="truncate font-mono text-[10px] tracking-wide text-ink3 uppercase">
            {channel.group}
            {lang ? ` · ${lang}` : ""}
          </p>
        </div>
        {active && <LiveBadge />}
        <button
          onClick={stop}
          aria-label={favorite ? "Remove favourite" : "Add favourite"}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
            favorite
              ? "text-ember"
              : "text-ink3 opacity-0 hover:text-ember focus-visible:opacity-100 group-hover:opacity-100"
          }`}
        >
          <Icon name="star" className="h-4 w-4" strokeWidth={favorite ? 2.3 : 1.7} />
        </button>
      </div>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(channel)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(channel);
        }
      }}
      className={`reveal group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 ${
        active
          ? "border-ember/70 bg-ember/8 shadow-[0_0_0_1px_color-mix(in_oklab,var(--c-ember)_35%,transparent),0_14px_30px_-20px_var(--c-ember)]"
          : "border-line bg-surface hover:border-ember/45 hover:bg-surface2 hover:shadow-[var(--c-shadow)]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] bg-ember transition-transform duration-300 ${
          active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
        }`}
      />
      <LogoTile channel={channel} />
      <div className="min-w-0 flex-1">
        <h3
          className={`truncate font-display text-[15px] leading-tight font-bold ${active ? "text-ember" : "text-ink"}`}
        >
          {channel.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.12em] text-ink3 uppercase">
          <span className="truncate">{channel.group}</span>
          {lang && (
            <>
              <span className="h-2.5 w-px bg-line" />
              <span className="truncate">{lang}</span>
            </>
          )}
        </div>
      </div>

      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
        {active && <LiveBadge />}
        <button
          onClick={stop}
          aria-label={favorite ? "Remove favourite" : "Add favourite"}
          className={`grid h-7 w-7 place-items-center rounded-md transition ${
            favorite
              ? "text-ember"
              : "text-ink3 opacity-0 hover:text-ember focus-visible:opacity-100 group-hover:opacity-100"
          }`}
        >
          <Icon name="star" className="h-4 w-4" strokeWidth={favorite ? 2.3 : 1.7} />
        </button>
      </div>

      <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="grid h-10 w-10 translate-y-6 place-items-center rounded-full bg-ember text-[#150a02] shadow-lg transition-transform duration-200 group-hover:translate-y-0">
          <Icon name="play" className="ml-0.5 h-5 w-5" strokeWidth={1.5} />
        </span>
      </span>
    </article>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.14em] text-white uppercase">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
      On air
    </span>
  );
}

export const ChannelCard = memo(ChannelCardBase);
