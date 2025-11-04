import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	return (
		<div className="bg-canvas flex flex-col items-center justify-center h-screen">
			<h1 className="text-4xl font-bold">
				<Link to="/workflows" className="text-8xl">
					TROPA.AI
				</Link>
			</h1>
		</div>
	);
}
