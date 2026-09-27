import { useCallback, useEffect, useState } from "react";
import { readPref, writePref } from "../lib/cache";

function usePersisted<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readPref<T>(key, fallback));
  useEffect(() => {
    writePref(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export type Theme = "dark" | "light";

export function useTheme() {
  const [theme, setTheme] = usePersisted<Theme>(
    "theme",
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080C12" : "#EEF1F6");
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

export type RelayMode = "off" | "auto" | "always";

export type Settings = {
  relay: RelayMode;
  autoplay: boolean;
  epg: boolean;
  customEpg: string;
};

export function useSettings() {
  return usePersisted<Settings>("settings", { relay: "auto", autoplay: true, epg: true, customEpg: "" });
}

export function useFavorites() {
  const [favorites, setFavorites] = usePersisted<string[]>("favorites", []);
  const set = new Set(favorites);

  const toggleFav = useCallback(
    (key: string) => {
      setFavorites((prev) => {
        const has = prev.includes(key);
        return has ? prev.filter((k) => k !== key) : [key, ...prev].slice(0, 400);
      });
      return !set.has(key);
    },
    [setFavorites, set],
  );

  return { favorites, favSet: set, toggleFav, has: (key: string) => set.has(key) };
}

export function useRecent() {
  const [recent, setRecent] = usePersisted<string[]>("recent", []);
  const push = useCallback(
    (key: string) => setRecent((prev) => [key, ...prev.filter((k) => k !== key)].slice(0, 24)),
    [setRecent],
  );
  const clear = useCallback(() => setRecent([]), [setRecent]);
  return { recent, push, clear };
}

export type ViewMode = "grid" | "list";
export function useViewMode() {
  return usePersisted<ViewMode>("view", "grid");
}
