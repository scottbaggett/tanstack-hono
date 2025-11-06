import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { ThemeContextProvider } from "../context/ThemeContext";
import { queryClient } from "../lib/query-client";
import type { RouterContext } from "../routerContext";
import appCss from "../styles/index.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		links: [
			{ rel: "icon", href: "/favicon.ico" },
			{ rel: "stylesheet", href: appCss },
		],
		meta: [
			{
				title: "Workflowz",
			},
			{
				charSet: "UTF-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1.0",
			},
		],
		scripts: [
			{
				children: `(function() {
					try {
						const STORAGE_KEY = 'theme';
						const DEFAULT_THEME = 'system';

						function applyTheme() {
							const theme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
							let resolvedTheme = theme;
							if (theme === 'system') {
								const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
								resolvedTheme = mediaQuery.matches ? 'dark' : 'light';
							}
							document.documentElement.classList.remove('dark', 'light');
							document.documentElement.classList.add(resolvedTheme);
						}

						// Apply theme immediately
						applyTheme();

						// Listen for system theme changes
						const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
						mediaQuery.addEventListener('change', () => {
							const currentTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
							if (currentTheme === 'system') {
								applyTheme();
							}
						});

						// Listen for localStorage changes from other tabs
						window.addEventListener('storage', (e) => {
							if (e.key === STORAGE_KEY) {
								applyTheme();
							}
						});
					} catch (e) {
						console.warn('Theme initialization failed:', e);
					}
				})();`,
			},
			...(!import.meta.env.PROD
				? [
						{
							type: "module",
							children: `import RefreshRuntime from "/@react-refresh"
  								RefreshRuntime.injectIntoGlobalHook(window)
  								window.$RefreshReg$ = () => {}
  								window.$RefreshSig$ = () => (type) => type
  								window.__vite_plugin_react_preamble_installed__ = true`,
						},
						{
							type: "module",
							src: "/@vite/client",
						},
					]
				: []),
			{
				type: "module",
				src: import.meta.env.PROD
					? "/assets/entry-client.js"
					: "/src/entry-client.tsx",
			},
		],
	}),
	errorComponent: ({ error }) => (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="min-h-screen flex items-center justify-center bg-red-50">
					<div className="text-center p-8">
						<h1 className="text-2xl font-bold text-red-600 mb-4">
							Something went wrong
						</h1>
						<p className="text-gray-600 mb-4">
							{error?.message || "An unexpected error occurred"}
						</p>
						<button
							type="button"
							className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
							onClick={() => window.location.reload()}
						>
							Reload Page
						</button>
					</div>
				</div>
			</body>
		</html>
	),
	component: RootComponent,
});

function RootComponent() {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeContextProvider>
					<QueryClientProvider client={queryClient}>
						<Outlet />
						<Toaster position="bottom-right" />
					</QueryClientProvider>
				</ThemeContextProvider>
				<Scripts />
			</body>
		</html>
	);
}
