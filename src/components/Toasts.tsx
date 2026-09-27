import { Icon } from "./Icons";
import { useToasts } from "../lib/toast";

export default function ToastHost() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(94vw,26rem)] -translate-x-1/2 flex-col gap-2 sm:left-4 sm:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-xl backdrop-blur ${
            t.tone === "bad"
              ? "border-live/40 bg-surface/95 text-ink"
              : t.tone === "good"
                ? "border-jade/40 bg-surface/95 text-ink"
                : "border-line bg-surface/95 text-ink"
          }`}
        >
          <span
            className={`mt-0.5 shrink-0 ${
              t.tone === "bad" ? "text-live" : t.tone === "good" ? "text-jade" : "text-ember"
            }`}
          >
            <Icon name={t.tone === "bad" ? "alert" : t.tone === "good" ? "check" : "info"} className="h-4 w-4" />
          </span>
          <p className="text-[13px] leading-snug">{t.text}</p>
        </div>
      ))}
    </div>
  );
}
