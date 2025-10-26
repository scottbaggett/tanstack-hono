/**
 * Node Panel Component
 *
 * Sidebar panel showing available nodes grouped by category
 * Allows dragging nodes onto the canvas
 */

import { useState } from "react";
import { useNodesByCategory } from "@/hooks/use-node-registry";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NodePanelProps {
	onNodeDrag?: (nodeId: string, event: React.DragEvent) => void;
}

export function NodePanel({ onNodeDrag }: NodePanelProps) {
	const { categories, allNodes, isLoading } = useNodesByCategory();
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedCategories, setExpandedCategories] = useState<
		Record<string, boolean>
	>({});

	// Filter nodes by search query
	const filteredNodes = allNodes.filter(
		(node) =>
			node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			node.description?.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// Rebuild categories with filtered nodes
	const filteredCategories = Object.entries(categories).reduce(
		(acc, [category, nodes]) => {
			const filtered = nodes.filter(
				(node) =>
					node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
					node.description?.toLowerCase().includes(searchQuery.toLowerCase()),
			);
			if (filtered.length > 0) {
				acc[category] = filtered;
			}
			return acc;
		},
		{} as Record<string, typeof allNodes>,
	);

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => ({
			...prev,
			[category]: !prev[category],
		}));
	};

	if (isLoading) {
		return (
			<div className="w-64 bg-editor-panel border-r  p-4">
				<div className="text-center text-gray-400">Loading nodes...</div>
			</div>
		);
	}

	const categoryOrder = [
		"input",
		"output",
		"transform",
		"llm",
		"integration",
		"utility",
		"other",
	];

	const sortedCategories = categoryOrder.filter(
		(cat) => filteredCategories[cat],
	);

	return (
		<div className="w-64 bg-editor-panel border-r overflow-y-auto h-full flex flex-col">
			{/* Header */}
			<div className="p-4 border-b border-gray-800">
				<h2 className="text-lg font-semibold text-white mb-4">Nodes</h2>
				<Input
					type="text"
					placeholder="Search nodes..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>

			{/* Node Categories */}
			<div className="flex-1 overflow-y-auto p-2">
				{sortedCategories.length === 0 ? (
					<div className="text-center text-gray-400 py-8">
						<p>No nodes found</p>
						<p className="text-sm">Try adjusting your search</p>
					</div>
				) : (
					sortedCategories.map((category) => (
						<Collapsible
							key={category}
							open={expandedCategories[category] ?? true}
							onOpenChange={() => toggleCategory(category)}
							className="mb-2"
						>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="w-full justify-between text-gray-300 hover:bg-gray-800"
								>
									<span className="capitalize font-medium">{category}</span>
									<LucideIcon
										name={
											expandedCategories[category]
												? "chevron-down"
												: "chevron-right"
										}
										className="h-4 w-4"
									/>
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent className="space-y-1 mt-1 pl-2">
								{filteredCategories[category]?.map((node) => (
									<NodeItem key={node.id} node={node} onDrag={onNodeDrag} />
								))}
							</CollapsibleContent>
						</Collapsible>
					))
				)}
			</div>

			{/* Footer Stats */}
			<div className="p-4 border-t border-gray-800 text-xs text-gray-400">
				<p>
					Showing {filteredNodes.length} of {allNodes.length} nodes
				</p>
			</div>
		</div>
	);
}

/**
 * Individual node item in the panel
 */
function NodeItem({
	node,
	onDrag,
}: {
	node: ReturnType<typeof useNodesByCategory>["allNodes"][0];
	onDrag?: (nodeId: string, event: React.DragEvent) => void;
}) {
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData(
			"application/json",
			JSON.stringify({ nodeId: node.id }),
		);
		onDrag?.(node.id, e);
	};

	return (
		<div
			draggable
			onDragStart={handleDragStart}
			className="p-2 rounded bg-card hover:bg-accent cursor-grab active:cursor-grabbing transition-colors"
		>
			<div className="flex items-start gap-2">
				{node.icon && (
					<LucideIcon
						name={node.icon}
						className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0"
					/>
				)}
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium text-white truncate">
						{node.displayName}
					</div>
					{node.description && (
						<div className="text-xs text-gray-400 line-clamp-2">
							{node.description}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
