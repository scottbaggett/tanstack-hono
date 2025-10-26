import { RouterClient } from "@tanstack/react-router/ssr/client";
import { hydrateRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import reportWebVitals from "./reportWebVitals";
import { createRouter } from "./router";
import { queryClient } from "./lib/query-client";

const router = createRouter();

hydrateRoot(
	document,
	<QueryClientProvider client={queryClient}>
		<RouterClient router={router} />
	</QueryClientProvider>
);

// Only report web vitals in development
if (import.meta.env.DEV) {
	reportWebVitals(console.log);
}
