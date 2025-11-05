import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "theme";

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") {
		return "light";
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getStoredTheme(): Theme {
	if (typeof window === "undefined") {
		return "system";
	}
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return (
		stored === "light" || stored === "dark" || stored === "system"
			? stored
			: "system"
	) as Theme;
}

function applyTheme(theme: "light" | "dark") {
	const root = document.documentElement;
	if (theme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
}

interface ThemeProviderProps {
	children: React.ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window !== "undefined") {
			return getStoredTheme();
		}
		return defaultTheme;
	});

	const resolveTheme = useCallback((themeValue: Theme): "light" | "dark" => {
		if (themeValue === "system") {
			return getSystemTheme();
		}
		return themeValue;
	}, []);

	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
		if (typeof window === "undefined") {
			return "light";
		}
		const stored = getStoredTheme();
		return resolveTheme(stored);
	});

	// Apply theme when theme preference changes
	useEffect(() => {
		const newResolved = resolveTheme(theme);
		applyTheme(newResolved);
		setResolvedTheme(newResolved);
	}, [theme, resolveTheme]);

	// Listen to system theme changes when theme is "system"
	useEffect(() => {
		if (theme !== "system") {
			return;
		}

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

		// Update immediately in case system theme changed
		const currentResolved = getSystemTheme();
		applyTheme(currentResolved);
		setResolvedTheme(currentResolved);

		function handleChange(event: MediaQueryListEvent) {
			const newResolved = event.matches ? "dark" : "light";
			applyTheme(newResolved);
			setResolvedTheme(newResolved);
		}

		// Use addEventListener (modern browsers) or addListener (older browsers)
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
			return () => {
				mediaQuery.removeEventListener("change", handleChange);
			};
		} else {
			// Fallback for older browsers
			mediaQuery.addListener(handleChange);
			return () => {
				mediaQuery.removeListener(handleChange);
			};
		}
	}, [theme]);

	function setTheme(newTheme: Theme) {
		setThemeState(newTheme);
		if (typeof window !== "undefined") {
			localStorage.setItem(storageKey, newTheme);
		}
	}

	return (
		<ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
