/**
 * Canvas Component
 *
 * Main workflow editor canvas using React Flow
 * Allows creating, editing, and connecting nodes
 */

import { useNavigate } from "@tanstack/react-router";
import {
	addEdge,
	Background,
	type Connection,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	ReactFlow,
	type ReactFlowInstance,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useNodeRegistry } from "@/hooks/use-node-registry";
import {
	useCreateWorkflow,
	useUpdateWorkflow,
	useWorkflow,
} from "@/hooks/use-workflows";
import { CanvasToolbar } from "./CanvasToolbar";
import { NodeEditorModal } from "./nodeEditorModal/NodeEditorModal";
import { WorkflowNode } from "./nodes/WorkflowNode";
import { NodePanel } from "./panels/NodePanel";

interface CanvasProps {
	workflowId?: string;
	selectedNodeId?: string;
}

// Define available node types
const nodeTypes = {
	workflow: WorkflowNode,
};

export function Canvas({
	workflowId: initialWorkflowId,
	selectedNodeId,
}: CanvasProps) {
	const navigate = useNavigate();
	const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
	const [workflowId, setWorkflowId] = useState(initialWorkflowId);
	const { data: workflow } = useWorkflow(workflowId || null);
	const updateWorkflow = useUpdateWorkflow();
	const createWorkflow = useCreateWorkflow();
	const { data: nodesRegistry } = useNodeRegistry();

	// Initialize nodes and edges from workflow definition
	// Nodes are stored as arrays in the workflow definition JSON
	const initialNodes = Array.isArray(workflow?.definition?.nodes)
		? (workflow.definition.nodes as Node[])
		: [];

	const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);

	// Find the selected node from selectedNodeId (after nodes are initialized)
	const selectedNodeFromId = selectedNodeId
		? nodes.find((n) => n.id === selectedNodeId) || null
		: null;

	// Edges are stored as arrays
	const initialEdges = Array.isArray(workflow?.definition?.edges)
		? (workflow.definition.edges as Edge[])
		: [];

	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

	const [selectedNode, setSelectedNode] = useState<Node | null>(null);
	const [showConfig, setShowConfig] = useState(false);

	// Track execution results per node (for visual indicators and input data)
	const [executionCache, setExecutionCache] = useState<
		Record<string, Record<string, unknown>>
	>({});

	// Track the last synced definition to prevent unnecessary updates
	const lastSyncedDefinitionRef = useRef<string>("");

	// Sync nodes and edges when workflow loads (only if definition actually changed)
	useEffect(() => {
		// Create a hash of the current definition to compare
		const currentDefinitionHash = JSON.stringify({
			nodes: workflow?.definition?.nodes,
			edges: workflow?.definition?.edges,
		});

		// Only sync if the definition actually changed
		if (currentDefinitionHash === lastSyncedDefinitionRef.current) {
			return;
		}

		// Update last synced definition
		lastSyncedDefinitionRef.current = currentDefinitionHash;

		if (
			workflow?.definition?.nodes &&
			Array.isArray(workflow.definition.nodes)
		) {
			setNodes(workflow.definition.nodes as Node[]);
		}
		if (
			workflow?.definition?.edges &&
			Array.isArray(workflow.definition.edges)
		) {
			setEdges(workflow.definition.edges as Edge[]);
		}
	}, [
		workflow?.definition?.nodes,
		workflow?.definition?.edges,
		setNodes,
		setEdges,
	]);

	// Handle node property updates
	const handleUpdateNodeData = useCallback(
		(nodeId: string, data: Record<string, unknown>) => {
			setNodes((nds) =>
				nds.map((node) =>
					node.id === nodeId
						? {
								...node,
								data: {
									...node.data,
									...data,
								},
						  }
						: node
				)
			);
		},
		[setNodes]
	);

	// Handle execution results from node test runs
	const handleExecutionComplete = useCallback(
		(_nodeId: string, runData: Record<string, unknown>) => {
			// Merge the runData into execution cache
			// runData is the full execution result with all nodes that were executed
			setExecutionCache((cache) => {
				const newCache = { ...cache };
				// Merge each node's execution data
				for (const [nodeId, nodeData] of Object.entries(runData)) {
					newCache[nodeId] = nodeData as Record<string, unknown>;
				}
				return newCache;
			});

			// Mark all executed nodes with their execution status (success or error)
			setNodes((nds) =>
				nds.map((node) => {
					const nodeRunData = runData[node.id];
					if (!nodeRunData) return node;

					// Extract the first run result (runData[nodeId] is an array)
					const runResult = Array.isArray(nodeRunData) ? nodeRunData[0] : null;
					if (!runResult) return node;

					// Determine execution status: success if data exists, error if error exists
					const hasError =
						runResult.error !== null && runResult.error !== undefined;
					const hasSuccess =
						runResult.data !== null && runResult.data !== undefined;

					return {
						...node,
						data: {
							...node.data,
							executionStatus: hasError
								? "error"
								: hasSuccess
								? "success"
								: undefined,
						},
					};
				})
			);
		},
		[setNodes]
	);

	// Update edge styles based on execution state
	useEffect(() => {
		setEdges((eds) =>
			eds.map((edge) => {
				const sourceNode = nodes.find((n) => n.id === edge.source);
				const targetNode = nodes.find((n) => n.id === edge.target);

				const sourceStatus = sourceNode?.data?.executionStatus;
				const targetStatus = targetNode?.data?.executionStatus;

				// Edge is green only if both nodes executed successfully
				const isSuccess =
					sourceStatus === "success" && targetStatus === "success";
				// Edge is red if either node has an error
				const hasError = sourceStatus === "error" || targetStatus === "error";

				return {
					...edge,
					animated: isSuccess,
					style: {
						...edge.style,
						stroke: isSuccess
							? "rgb(48, 164, 108)" // green-9
							: hasError
							? "rgb(229, 62, 62)" // red-9
							: undefined,
						strokeWidth: isSuccess || hasError ? 2 : 1,
					},
				};
			})
		);
	}, [nodes, setEdges]);

	// Handle new connections
	const onConnect = useCallback(
		(connection: Connection) => {
			setEdges((eds) => addEdge(connection, eds));
		},
		[setEdges]
	);

	// Generate auto-incremented names based on node type
	const getAutoName = useCallback(
		(nodeId: string, existingNodes: Node[]): string => {
			// Extract the display name for the node type
			const nodeDefinition = nodesRegistry?.nodes?.find((n) => n.id === nodeId);
			const baseName = nodeDefinition?.displayName || nodeId;

			// Count existing nodes with same base name
			const count = existingNodes.filter(
				(n) =>
					typeof n.data?.name === "string" && n.data.name.startsWith(baseName)
			).length;

			return count > 0 ? `${baseName} ${count + 1}` : baseName;
		},
		[nodesRegistry?.nodes]
	);

	// Save workflow (create if doesn't exist, update if exists)
	const handleSave = useCallback(async () => {
		try {
			const definition = {
				nodes,
				edges,
				viewport: { x: 0, y: 0, zoom: 1 },
			};

			if (!workflowId) {
				// Create new workflow
				const result = await createWorkflow.mutateAsync({
					name: "Untitled Workflow",
					description: "Created from canvas",
					definition,
				});
				if (result?.id) {
					setWorkflowId(result.id);
					// Update last synced definition to match what we just saved
					lastSyncedDefinitionRef.current = JSON.stringify(definition);
					// Navigate to the workflow URL so it persists on refresh
					await navigate({
						to: "/workflow/$workflowId",
						params: { workflowId: result.id },
					});
				}
			} else {
				// Update existing workflow
				await updateWorkflow.mutateAsync({
					workflowId,
					definition,
				});
				// Update last synced definition to match what we just saved
				lastSyncedDefinitionRef.current = JSON.stringify(definition);
			}
		} catch (error) {
			console.error("Failed to save workflow:", error);
		}
	}, [workflowId, nodes, edges, updateWorkflow, createWorkflow, navigate]);

	const handleNodeDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault();
			const data = event.dataTransfer.getData("application/json");

			if (!data) return;

			try {
				const { nodeId: nodeType } = JSON.parse(data);

				// Find the node definition from registry
				const nodeDefinition = nodesRegistry?.nodes?.find(
					(n) => n.id === nodeType
				);

				if (!nodeDefinition) {
					console.warn(`Node definition not found for: ${nodeType}`);
					return;
				}

				// Generate UUID for this node instance
				const nodeInstanceId =
					crypto.randomUUID?.() ||
					`node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				// Generate human-readable name
				const autoName = getAutoName(nodeType, nodes);

				// Convert screen coordinates to flow coordinates
				const position = reactFlowInstance.current?.screenToFlowPosition({
					x: event.clientX,
					y: event.clientY,
				}) || {
					x: event.clientX,
					y: event.clientY,
				};

				// Create new node at drop position with full definition data
				const newNode: Node = {
					id: nodeInstanceId,
					type: "workflow",
					data: {
						label: nodeDefinition.displayName || nodeType,
						name: autoName,
						nodeType,
						displayName: nodeDefinition.displayName,
						description: nodeDefinition.description,
						icon: nodeDefinition.icon,
						color: nodeDefinition.color,
						inputs: nodeDefinition.inputs,
						outputs: nodeDefinition.outputs,
						properties: nodeDefinition.properties || [],
					},
					position,
				};
				setNodes((nds) => [...nds, newNode]);
			} catch (error) {
				console.error("Failed to drop node:", error);
			}
		},
		[setNodes, nodesRegistry?.nodes, getAutoName, nodes]
	);

	return (
		<div className="h-screen w-screen flex flex-col bg-gray-950">
			{/* Toolbar */}
			<CanvasToolbar
				workflowName={workflow?.name || "Untitled Workflow"}
				workflowId={workflowId}
				hasSelectedNode={!!selectedNode}
				isSaving={updateWorkflow.isPending || createWorkflow.isPending}
				onSave={handleSave}
			/>

			{/* Main Layout */}
			<div className="flex-1 flex overflow-hidden">
				{/* Node Panel (Left) */}
				<NodePanel />

				{/* Canvas (Center) */}
				<section
					className="flex-1 overflow-hidden cursor-grab"
					aria-label="Canvas"
					tabIndex={-1}
					onDragOver={(e) => e.preventDefault()}
					onDrop={handleNodeDrop}
				>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						nodeTypes={nodeTypes}
						onInit={(instance) => {
							reactFlowInstance.current = instance;
						}}
						snapToGrid={true}
						onNodeDoubleClick={(_, node) => {
							// Navigate to node modal using search params
							if (workflowId) {
								navigate({
									to: "/workflow/$workflowId",
									params: { workflowId },
									search: { nodeId: node.id },
								});
							} else {
								// If no workflowId yet, just set the selected node locally
								setSelectedNode(node);
								setShowConfig(true);
							}
						}}
						onPaneClick={() => {
							// Clear nodeId from URL when clicking pane
							if (workflowId && selectedNodeId) {
								navigate({
									to: "/workflow/$workflowId",
									params: { workflowId },
									search: {},
								});
							}
							setSelectedNode(null);
							setShowConfig(false);
						}}
						fitView
					>
						<Background color="#1f2937" gap={16} />
						<Controls />
						<MiniMap />
					</ReactFlow>
				</section>
			</div>

			{/* Node Editor Modal */}
			{(() => {
				const nodeToEdit = selectedNodeFromId || selectedNode;
				if (
					!nodeToEdit ||
					!((showConfig && selectedNode) || selectedNodeFromId)
				) {
					return null;
				}
				return (
					<NodeEditorModal
						selectedNode={nodeToEdit}
						onClose={() => {
							setShowConfig(false);
							// Clear nodeId from URL
							if (workflowId && selectedNodeId) {
								navigate({
									to: "/workflow/$workflowId",
									params: { workflowId },
									search: {},
								});
							}
						}}
						onUpdateNode={handleUpdateNodeData}
						onExecutionComplete={handleExecutionComplete}
						workflowEdges={
							edges as Array<{
								source: string;
								target: string;
								sourceHandle?: string;
								targetHandle?: string;
							}>
						}
						allNodes={nodes}
						nodeRegistry={nodesRegistry}
						executionCache={executionCache}
					/>
				);
			})()}
		</div>
	);
}
