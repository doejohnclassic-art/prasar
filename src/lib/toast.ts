import { useCallback, useEffect, useState } from "react";

export type Toast = { id: number; text: string; tone: "info" | "good" | "bad" };

let seq = 0;
const listeners = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

function emit() {
  for (const l of listeners) l([...toasts]);
}

export function toast(text: string, tone: Toast["tone"] = "info") {
  const id = ++seq;
  toasts = [...toasts, { id, text, tone }].slice(-4);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4200);
}

export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>(toasts);
  const cb = useCallback((t: Toast[]) => setList(t), []);
  useEffect(() => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [cb]);
  return list;
}
