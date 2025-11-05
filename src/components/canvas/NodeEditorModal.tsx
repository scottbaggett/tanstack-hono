/**
 * Node Editor Modal
 *
 * Full-screen three-panel node configuration modal
 * Left: Input Explorer
 * Center: Parameters
 * Right: Test & Output
 */

import { useState, useEffect } from "react";
import type { Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { InputExplorer } from "./panels/InputExplorer";
import { ParametersPanel } from "./panels/ParametersPanel";
import { OutputPanel } from "./panels/OutputPanel";

interface NodeEditorModalProps {
	selectedNode: Node;
	onClose: () => void;
	onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
	workflowEdges: Array<{
		source: string;
		target: string;
		sourceHandle?: string;
		targetHandle?: string;
	}>;
	allNodes: Node[];
	nodeRegistry: any;
}

export function NodeEditorModal({
	selectedNode,
	onClose,
	onUpdateNode,
	workflowEdges,
	allNodes,
	nodeRegistry,
}: NodeEditorModalProps) {
	const nodeData = selectedNode.data as Record<string, unknown>;
	const [executionResult, setExecutionResult] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [allExecutionResults, setAllExecutionResults] = useState<Record<
		string,
		unknown
	> | null>(null);
	const [isExecuting, setIsExecuting] = useState(false);
	// Track current form values (may differ from saved values)
	// Initialize with defaults from property definitions, then override with saved values
	const [currentPropertyValues, setCurrentPropertyValues] = useState<
		Record<string, unknown>
	>(() => {
		const nodeType = (selectedNode.data as any).nodeType || (selectedNode.data as any).nodeId;
		const registryNode = nodeRegistry?.nodes?.find((n: any) => n.id === nodeType);
		const properties = Array.isArray(registryNode?.properties) ? registryNode.properties : [];

		// Build defaults from property definitions
		const defaults: Record<string, unknown> = {};
		for (const prop of properties) {
			if (prop && typeof prop === 'object' && 'name' in prop && 'default' in prop) {
				defaults[prop.name] = prop.default;
			}
		}

		// Merge defaults with saved values (saved values take precedence)
		return {
			...defaults,
			...((nodeData.propertyValues as Record<string, unknown>) || {}),
		};
	});

	// Handle escape key to close modal
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	// Auto-save property changes
	useEffect(() => {
		// Update the node data whenever property values change
		onUpdateNode(selectedNode.id, {
			...selectedNode.data,
			propertyValues: currentPropertyValues,
		});
		// Note: We intentionally don't include selectedNode.data in deps to avoid infinite loops
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPropertyValues, selectedNode.id, onUpdateNode]);

	// Find all connected input nodes
	const connectedNodeIds = workflowEdges
		.filter((edge) => edge.target === selectedNode.id)
		.map((edge) => edge.source);

	const connectedNodes = allNodes.filter((node) =>
		connectedNodeIds.includes(node.id)
	);

	const handleExecute = async () => {
		setIsExecuting(true);
		try {
			// Create updated nodes array with current form values
			const updatedNodes = allNodes.map((node) =>
				node.id === selectedNode.id
					? {
							...node,
							data: {
								...node.data,
								propertyValues: currentPropertyValues,
							},
					  }
					: node
			);

			// Call node execution API with workflow context
			const response = await fetch(`/api/node-execute/${selectedNode.id}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					workflowDefinition: {
						nodes: updatedNodes,
						edges: workflowEdges,
					},
					parameters: currentPropertyValues,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Execution failed");
			}

			const result = await response.json();
			// Extract data from runData structure: runData[nodeId][0]
			const nodeRun = result.runData?.[selectedNode.id]?.[0];
			if (nodeRun) {
				// Pass the entire nodeRun (contains both data and error)
				setExecutionResult(nodeRun.error ? { error: nodeRun.error } : nodeRun.data);
			}
			setAllExecutionResults(result.runData || {});
		} catch (error) {
			console.error("Execution failed:", error);
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			setExecutionResult({
				error: errorMessage,
			} as any);
		} finally {
			setIsExecuting(false);
		}
	};

	return (
		<div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 pointer-events-none">
			{/* Modal Container */}
			<div className="bg-surface-2 rounded-lg shadow-2xl h-[90vh] w-[95vw] flex flex-col pointer-events-auto border">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-3">
						{typeof nodeData.icon === "string" && (
							<LucideIcon name={nodeData.icon} className="h-6 w-6" />
						)}
						<div>
							<h2 className="text-lg font-semibold">
								{(nodeData.displayName as string) || (nodeData.label as string)}
							</h2>
						</div>
					</div>
					{/* Execute Button */}
					<Button onClick={handleExecute} disabled={isExecuting} size="sm">
						{isExecuting ? (
							<LucideIcon
								name="loader-2"
								className="h-4 w-4 mr-2 animate-spin"
							/>
						) : (
							<LucideIcon name="play" className="h-4 w-4 mr-2" />
						)}
						Execute Node
					</Button>
				</div>

				{/* Three Panel Layout */}
				<div className="flex-1 flex overflow-hidden">
					{/* Left Panel - Input Explorer */}
					<div className="w-1/4 border-r border-surface-6 overflow-y-auto">
						<InputExplorer
							connectedNodes={connectedNodes}
							executionResults={allExecutionResults}
						/>
					</div>

					{/* Center Panel - Parameters */}
					<div className="flex-1 overflow-y-auto">
						<ParametersPanel
							selectedNode={selectedNode}
							onUpdateNode={onUpdateNode}
							nodeRegistry={nodeRegistry}
							currentPropertyValues={currentPropertyValues}
							onPropertyValuesChange={setCurrentPropertyValues}
						/>
					</div>

					{/* Right Panel - Test & Output */}
					<div className="w-1/3 border-l flex flex-col">
						<OutputPanel
							isExecuting={isExecuting}
							onExecute={handleExecute}
							executionResult={executionResult}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
