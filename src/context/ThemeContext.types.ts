import { Computer, Moon, Sun, type LucideIcon } from "lucide-react";

/**
 * Theme represents the actual theme of the application. Currently, there are
 * only two themes: 'light' and 'dark'.
 */
export type Theme = 'light' | 'dark';

/**
 * ThemePreference represents the possible settings for the theme. The 'system'
 * option will use the system's theme setting.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemeContextState = {
  activeTheme: Theme;
  systemTheme: Theme;
  themePreference: ThemePreference;
  setThemePreference: (themePreference: ThemePreference) => void;
};

/**
 * Default theme preference when no preference is set by the user
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
export const LOCALSTORAGEKEY_THEME_PREFERENCE = 'theme';

/**
 * Get the media query for system theme dark mode.
 * Safe for SSR - returns a fallback that matches light mode on server.
 */
export const getMediaQueryIsSystemThemeDark = (): MediaQueryList => {
	if (typeof window === 'undefined') {
		// Return a mock MediaQueryList for SSR
		return {
			matches: false,
			media: '(prefers-color-scheme: dark)',
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		} as MediaQueryList;
	}
	return window.matchMedia('(prefers-color-scheme: dark)');
};
export const THEME_PREFERENCE_ICON_MAP: Record<ThemePreference, LucideIcon> = {
  dark: Moon,
  light: Sun,
  system: Computer,
};
