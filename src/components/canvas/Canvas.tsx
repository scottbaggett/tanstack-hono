/**
 * Canvas Component
 *
 * Main workflow editor canvas using React Flow
 * Allows creating, editing, and connecting nodes
 */

import { useCallback, useState } from "react";
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
import { NodeConfigPanel } from "./NodeConfigPanel";
import { useWorkflow, useUpdateWorkflow, useCreateWorkflow } from "@/hooks/use-workflows";
import { useNodeRegistry } from "@/hooks/use-node-registry";

interface CanvasProps {
	workflowId?: string;
}

// Define available node types
const nodeTypes = {
	workflow: WorkflowNode,
};

export function Canvas({ workflowId: initialWorkflowId }: CanvasProps) {
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
	}, [workflowId, nodes, edges, updateWorkflow, createWorkflow]);

	const handleNodeDrop = useCallback(
		(event: React.DragEvent) => {
			event.preventDefault();
			const data = event.dataTransfer.getData("application/json");

			if (!data) return;

			try {
				const { nodeId } = JSON.parse(data);

				// Find the node definition from registry
				const nodeDefinition = nodesRegistry?.nodes?.find((n) => n.id === nodeId);

				if (!nodeDefinition) {
					console.warn(`Node definition not found for: ${nodeId}`);
					return;
				}

				// Create new node at drop position with full definition data
				const newNode: Node = {
					id: `${nodeId}-${Date.now()}`,
					type: "workflow",
					data: {
						label: nodeDefinition.displayName || nodeId,
						nodeId,
						displayName: nodeDefinition.displayName,
						description: nodeDefinition.description,
						icon: nodeDefinition.icon,
						color: nodeDefinition.color,
						inputs: nodeDefinition.inputs,
						outputs: nodeDefinition.outputs,
					},
					position: {
						x: event.clientX - 100,
						y: event.clientY - 100
					},
				};
				setNodes((nds) => [...nds, newNode]);
			} catch (error) {
				console.error("Failed to drop node:", error);
			}
		},
		[setNodes, nodesRegistry?.nodes]
	);

	return (
		<div className="h-screen w-screen flex flex-col bg-gray-950">
			{/* Toolbar */}
			<CanvasToolbar
				onAddNode={handleAddNode}
				onDeleteNode={handleDeleteNode}
				onSave={handleSave}
				hasSelectedNode={!!selectedNode}
				isSaving={updateWorkflow.isPending || createWorkflow.isPending}
				workflowId={workflowId}
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
						onNodeClick={(_, node) => {
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

				{/* Node Config Panel (Right) */}
				{showConfig && (
					<NodeConfigPanel
						selectedNode={selectedNode}
						onUpdateNode={handleUpdateNodeData}
						onClose={() => {
							setShowConfig(false);
						}}
					/>
				)}
			</div>
		</div>
	);
}
