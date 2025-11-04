import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import type { RouterContext } from "./routerContext";
import { routeTree } from "./routeTree.gen.ts";

export function createRouter() {
	return createTanstackRouter({
		routeTree,
		context: {
			head: "",
		} as RouterContext,
		defaultPreload: "intent",
		scrollRestoration: true,
		defaultStructuralSharing: true,
		defaultPreloadStaleTime: 0,
		defaultNotFoundComponent: () => (
			<div className="h-screen w-screen flex items-center justify-center flex-col gap-3">
				<h1 className="text-4xl font-bold">404</h1>
				<p>The page you are looking for does not exist.</p>
			</div>
		),
		defaultErrorComponent: ({ error }) => (
			<div className="h-screen w-screen bg-destructive flex items-center justify-center flex-col gap-3">
				<h1 className="text-4xl font-bold text-white">Error</h1>
				<p className="text-white">{error.message}</p>
			</div>
		),
		defaultPendingComponent: () => (
			<div className="h-screen w-screen bg-blue-500 flex items-center justify-center flex-col gap-3">
				<h1 className="text-4xl font-bold text-white">Loading...</h1>
				<p className="text-white">Please wait while we load the page.</p>
			</div>
		),
	});
}

// Register the router instance for type safety
declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof createRouter>;
	}
}
