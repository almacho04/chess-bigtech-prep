export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "chess.theme";

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignore
  }
  return "system";
}

export function writeStoredPreference(pref: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore
  }
}

/**
 * Runs synchronously in <head> before React hydrates, so the document already
 * has the right `data-theme` attribute on first paint (no flash).
 */
export const themeBootScript = `
(function() {
  try {
    var k = ${JSON.stringify(THEME_STORAGE_KEY)};
    var raw = window.localStorage.getItem(k);
    var pref = (raw === 'light' || raw === 'dark' || raw === 'system') ? raw : 'system';
    var resolved = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref;
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;
