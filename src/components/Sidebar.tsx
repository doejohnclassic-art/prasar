import { Icon, LogoMark } from "./Icons";
import { SECTIONS, languageName } from "../lib/playlist";

export type Selection =
  | { kind: "all" }
  | { kind: "favs" }
  | { kind: "recent" }
  | { kind: "section"; value: string }
  | { kind: "lang"; value: string }
  | { kind: "group"; value: string };

export const SECTION_ICONS: Record<string, string> = {
  all: "grid",
  favorites: "star",
  recent: "refresh",
  news: "bolt",
  sports: "signal",
  entertainment: "tv",
  movies: "play",
  music: "volume",
  kids: "heart",
  devotional: "shield",
  factual: "globe",
  general: "layers",
};

type Props = {
  selection: Selection;
  onSelect: (s: Selection) => void;
  counts: Record<string, number>;
  languages: { code: string; count: number }[];
  total: number;
  enriched: boolean;
  ready: boolean;
};

function same(a: Selection, b: Selection) {
  return a.kind === b.kind && (a as { value?: string }).value === (b as { value?: string }).value;
}

function Row({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13.5px] transition-all duration-150 ${
        active ? "bg-ember/12 font-semibold text-ember" : "text-ink2 hover:bg-surface2 hover:text-ink"
      }`}
    >
      <span
        className={`absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r bg-ember transition-transform duration-200 ${
          active ? "scale-y-100" : "scale-y-0 group-hover:scale-y-50"
        }`}
      />
      <Icon name={icon} className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.6} />
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
        <span
          className={`shrink-0 font-mono text-[10px] tabular-nums ${active ? "text-ember/80" : "text-ink3 group-hover:text-ink2"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-1.5 px-2.5 font-mono text-[9.5px] tracking-[0.24em] text-ink3 uppercase">{children}</p>
  );
}

export default function Sidebar({ selection, onSelect, counts, languages, total, enriched, ready }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 pt-1 pb-4">
        <span className="text-ember">
          <LogoMark className="h-8 w-8" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[17px] leading-none font-extrabold tracking-tight text-ink">PRASAR</p>
          <p className="mt-1 font-mono text-[9px] tracking-[0.22em] text-ink3 uppercase">free · open · india</p>
        </div>
      </div>

      <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
        <GroupLabel>Your set</GroupLabel>
        <Row
          active={same(selection, { kind: "all" })}
          icon="grid"
          label="All channels"
          count={ready ? total : undefined}
          onClick={() => onSelect({ kind: "all" })}
        />
        <Row
          active={same(selection, { kind: "favs" })}
          icon="star"
          label="Favourites"
          count={counts.favs ?? 0}
          onClick={() => onSelect({ kind: "favs" })}
        />
        <Row
          active={same(selection, { kind: "recent" })}
          icon="refresh"
          label="Recently watched"
          count={counts.recent ?? 0}
          onClick={() => onSelect({ kind: "recent" })}
        />

        <GroupLabel>Categories</GroupLabel>
        {SECTIONS.map((s) => (
          <Row
            key={s.id}
            active={same(selection, { kind: "section", value: s.id })}
            icon={SECTION_ICONS[s.id] ?? "layers"}
            label={s.label}
            count={ready ? counts[`s:${s.id}`] : undefined}
            onClick={() => onSelect({ kind: "section", value: s.id })}
          />
        ))}
        <Row
          active={same(selection, { kind: "section", value: "general" })}
          icon="layers"
          label="Uncategorised"
          count={ready ? counts["s:general"] : undefined}
          onClick={() => onSelect({ kind: "section", value: "general" })}
        />

        <GroupLabel>{enriched ? "Regional · by language" : "Regional"}</GroupLabel>
        {languages.length === 0 && (
          <p className="px-2.5 py-1.5 text-[12px] leading-relaxed text-ink3">
            {enriched ? "No language tags in this playlist yet." : "Language tags load with channel metadata…"}
          </p>
        )}
        {languages.slice(0, 14).map((l) => (
          <Row
            key={l.code}
            active={same(selection, { kind: "lang", value: l.code })}
            icon="globe"
            label={languageName(l.code)}
            count={l.count}
            onClick={() => onSelect({ kind: "lang", value: l.code })}
          />
        ))}
        {languages.length > 14 && (
          <p className="px-2.5 pt-1 font-mono text-[10px] text-ink3">+{languages.length - 14} more languages</p>
        )}
      </nav>

      <div className="border-t border-linesoft px-3 py-3">
        <div className="flex items-center justify-between font-mono text-[9.5px] tracking-[0.16em] text-ink3 uppercase">
          <span>source</span>
          <a
            href="https://github.com/iptv-org/iptv"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-ink2 transition hover:text-ember"
          >
            iptv-org <Icon name="external" className="h-3 w-3" />
          </a>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink3">
          Public, freely available streams only. No accounts, no fees, no tracking.
        </p>
      </div>
    </div>
  );
}
