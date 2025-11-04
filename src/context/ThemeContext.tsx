/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { createContext, useEffect, useState } from "react";
import {
	DEFAULT_THEME_PREFERENCE,
	LOCALSTORAGEKEY_THEME_PREFERENCE,
	type Theme,
	type ThemeContextState,
	type ThemePreference,
} from "./ThemeContext.types";

const useThemePreference = (): [
	ThemePreference,
	(themePreference: ThemePreference) => void
] => {
	const [themePreference, setThemePreference] = useState<ThemePreference>(
		DEFAULT_THEME_PREFERENCE
	);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(
			LOCALSTORAGEKEY_THEME_PREFERENCE
		) as ThemePreference | null;
		if (stored) {
			setThemePreference(stored);
		}
	}, []);

	useEffect(() => {
		if (!mounted) return;
		localStorage.setItem(LOCALSTORAGEKEY_THEME_PREFERENCE, themePreference);
	}, [themePreference, mounted]);

	return [themePreference, setThemePreference];
};

const useSystemTheme = () => {
	const [systemTheme, setSystemTheme] = useState<Theme>("light");

	useEffect(() => {
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		const updateTheme = () => {
			setSystemTheme(mediaQuery.matches ? "dark" : "light");
		};

		updateTheme();

		const handleChange = () => updateTheme();
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	return systemTheme;
};

export const ThemeContext = createContext<ThemeContextState | undefined>(
	undefined
);

export const ThemeContextProvider = ({ children }: { children: ReactNode }) => {
	const [themePreference, setThemePreference] = useThemePreference();
	const systemTheme = useSystemTheme();
	const [mounted, setMounted] = useState(false);

	const activeTheme: Theme =
		themePreference === "system" ? systemTheme : (themePreference as Theme);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Sync React state with DOM - but only after mount to avoid hydration issues
	useEffect(() => {
		if (!mounted) return;
		document.documentElement.classList.remove("dark", "light");
		document.documentElement.classList.add(activeTheme);
	}, [activeTheme, mounted]);

	return (
		<ThemeContext.Provider
			value={{ activeTheme, systemTheme, themePreference, setThemePreference }}
		>
			{children}
		</ThemeContext.Provider>
	);
};
