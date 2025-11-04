/**
 * Canvas Component
 *
 * Main workflow editor canvas using React Flow
 * Allows creating, editing, and connecting nodes
 */

import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	addEdge,
	type Connection,
	useNodesState,
	useEdgesState,
	type Node,
	type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasToolbar } from "./CanvasToolbar";
import { NodePanel } from "./NodePanel";
import { WorkflowNode } from "./nodes/WorkflowNode";
import { NodeEditorModal } from "./NodeEditorModal";
import {
	useWorkflow,
	useUpdateWorkflow,
	useCreateWorkflow,
} from "@/hooks/use-workflows";
import { useNodeRegistry } from "@/hooks/use-node-registry";

interface CanvasProps {
	workflowId?: string;
}

// Define available node types
const nodeTypes = {
	workflow: WorkflowNode,
};

export function Canvas({ workflowId: initialWorkflowId }: CanvasProps) {
	const navigate = useNavigate();
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

	// Edges are stored as arrays
	const initialEdges = Array.isArray(workflow?.definition?.edges)
		? (workflow.definition.edges as Edge[])
		: [];

	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

	const [selectedNode, setSelectedNode] = useState<Node | null>(null);
	const [showConfig, setShowConfig] = useState(false);

	// Sync nodes and edges when workflow loads
	useEffect(() => {
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

	// Add new node
	const handleAddNode = useCallback(() => {
		const newNode: Node = {
			id: `node-${Date.now()}`,
			data: { label: "New Node" },
			position: { x: Math.random() * 500, y: Math.random() * 500 },
			type: "workflow",
		};
		setNodes((nds) => [...nds, newNode]);
	}, [setNodes]);

	// Delete selected node
	const handleDeleteNode = useCallback(() => {
		if (!selectedNode) return;
		setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
		setEdges((eds) =>
			eds.filter(
				(e) => e.source !== selectedNode.id && e.target !== selectedNode.id
			)
		);
		setSelectedNode(null);
	}, [selectedNode, setNodes, setEdges]);

	// Save workflow (create if doesn't exist, update if exists)
	const handleSave = useCallback(async () => {
		try {
			if (!workflowId) {
				// Create new workflow
				const result = await createWorkflow.mutateAsync({
					name: "Untitled Workflow",
					description: "Created from canvas",
					definition: {
						nodes,
						edges,
						viewport: { x: 0, y: 0, zoom: 1 },
					},
				});
				if (result?.id) {
					setWorkflowId(result.id);
					// Navigate to the workflow URL so it persists on refresh
					await navigate({
						to: "/canvas",
						search: { workflowId: result.id },
					});
				}
			} else {
				// Update existing workflow
				await updateWorkflow.mutateAsync({
					workflowId,
					definition: {
						nodes,
						edges,
						viewport: { x: 0, y: 0, zoom: 1 },
					},
				});
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
				const { nodeId } = JSON.parse(data);

				// Find the node definition from registry
				const nodeDefinition = nodesRegistry?.nodes?.find(
					(n) => n.id === nodeId
				);

				if (!nodeDefinition) {
					console.warn(`Node definition not found for: ${nodeId}`);
					return;
				}

				// Generate UUID for this node instance
				const nodeInstanceId =
					crypto.randomUUID?.() ||
					`node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

				// Generate human-readable name
				const autoName = getAutoName(nodeId, nodes);

				// Create new node at drop position with full definition data
				const newNode: Node = {
					id: nodeInstanceId,
					type: "workflow",
					data: {
						label: nodeDefinition.displayName || nodeId,
						name: autoName,
						nodeId,
						displayName: nodeDefinition.displayName,
						description: nodeDefinition.description,
						icon: nodeDefinition.icon,
						color: nodeDefinition.color,
						inputs: nodeDefinition.inputs,
						outputs: nodeDefinition.outputs,
						properties: nodeDefinition.properties || [],
					},
					position: {
						x: event.clientX - 100,
						y: event.clientY - 100,
					},
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
				<div
					className="flex-1 overflow-hidden"
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
						onNodeDoubleClick={(_, node) => {
							setSelectedNode(node);
							setShowConfig(true);
						}}
						onPaneClick={() => {
							setSelectedNode(null);
							setShowConfig(false);
						}}
						fitView
					>
						<Background color="#1f2937" gap={16} />
						<Controls />
						<MiniMap />
					</ReactFlow>
				</div>
			</div>

			{/* Node Editor Modal */}
			{showConfig && selectedNode && (
				<NodeEditorModal
					selectedNode={selectedNode}
					onClose={() => {
						setShowConfig(false);
					}}
					onUpdateNode={handleUpdateNodeData}
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
				/>
			)}
		</div>
	);
}
