import { QueryClientProvider } from "@tanstack/react-query";
import { RouterClient } from "@tanstack/react-router/ssr/client";
import { hydrateRoot } from "react-dom/client";
import { queryClient } from "./lib/query-client";
import reportWebVitals from "./reportWebVitals";
import { createRouter } from "./router";

const router = createRouter();

hydrateRoot(
	document,
	<QueryClientProvider client={queryClient}>
		<RouterClient router={router} />
	</QueryClientProvider>,
);

// Only report web vitals in development
if (import.meta.env.DEV) {
	reportWebVitals(console.log);
}
