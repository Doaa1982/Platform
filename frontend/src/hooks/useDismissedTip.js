import { useCallback, useState } from "react";

const STORAGE_KEY = "lw.dismissedTips";

function readDismissed() {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

/**
 * Tracks whether a TutorTip with a given `id` has been dismissed — persisted
 * so it stays dismissed across reloads and sessions, same localStorage-backed
 * pattern as ThemeContext/LanguageContext. `id` should be a stable string
 * unique to that one tip (e.g. "studio.quizGenSaveTip").
 */
export function useDismissedTip(id) {
  const [dismissed, setDismissed] = useState(() => readDismissed().has(id));

  const dismiss = useCallback(() => {
    const set = readDismissed();
    set.add(id);
    writeDismissed(set);
    setDismissed(true);
  }, [id]);

  return [dismissed, dismiss];
}
