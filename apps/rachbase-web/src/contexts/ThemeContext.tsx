'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'rachbase-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Resolve the initial theme: saved choice first, otherwise the OS preference. */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [userChose, setUserChose] = useState(false);

  // Hydrate from storage / system on mount (client only).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setUserChose(stored === 'light' || stored === 'dark');
    setThemeState(getInitialTheme());
  }, []);

  // Apply `.dark` to <html> so Radix portals (dialogs, sheets, popovers,
  // dropdowns, command palette) that render at document.body are themed too.
  // Removed on unmount so marketing routes outside the dashboard stay light.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    return () => root.classList.remove('dark');
  }, [theme]);

  // Follow live OS changes until the user makes an explicit choice.
  useEffect(() => {
    if (userChose) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) =>
      setThemeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [userChose]);

  const setTheme = useCallback((next: Theme) => {
    setUserChose(true);
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setUserChose(true);
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
