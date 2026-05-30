import { useState, useCallback } from 'react';

type ColVisibility = Record<string, boolean>;

export function useColumnVisibility(storageKey: string, defaults: ColVisibility) {
  const [visibility, setVisibility] = useState<ColVisibility>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return { ...defaults };
  });

  const toggle = useCallback((key: string) => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const reset = useCallback(() => {
    setVisibility({ ...defaults });
    localStorage.removeItem(storageKey);
  }, [storageKey, defaults]);

  return { visibility, toggle, reset };
}
