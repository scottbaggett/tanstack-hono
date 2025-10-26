import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "../logo.svg";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	return (
		<div className="bg-canvas flex flex-col items-center justify-center h-screen">
			<h1 className="text-4xl font-bold">
				Welcome to <Link to="/workflows">Workflowz</Link>
			</h1>
		</div>
	);
}
