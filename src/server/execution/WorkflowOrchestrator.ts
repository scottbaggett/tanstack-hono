/**
 * Workflow Orchestrator
 *
 * Orchestrates workflow execution by:
 * 1. Loading the workflow definition
 * 2. Performing topological sort to get execution order
 * 3. Executing nodes in dependency order
 * 4. Managing state (collecting node outputs)
 * 5. Emitting events for streaming/logging
 * 6. Recording execution history
 */

import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Tool } from "@langchain/core/tools";
// Note: BufferMemory was removed in LangChain 1.0 - using LangGraph state instead
// import { BufferMemory } from "langchain/memory";

import type { IWorkflowDefinition } from "../../types/interfaces";
import type { INodeExecutionData } from "../../types/execution";
import type { StreamEvent } from "../../types/execution";
import { nodeRegistry } from "../nodes/registry";
import { ExecuteFunctions } from "./ExecuteFunctions";
import { resolveInputs } from "./InputResolver";
import type {
	EngineRequest,
	RequestResponseMetadata,
} from "../types/agent";
import { handleEngineRequest } from "./requestHandler";
import type { IExecutionContext } from "../../types/interfaces";
import type { InternalTraceData, InternalStep } from "../db/schema";
import { db } from "../db";
import { nodeExecutions } from "../db/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface OrchestrationConfig {
	workflowId: string;
	runId: string;
	definition: IWorkflowDefinition;
	inputs?: Record<string, unknown>;
	langchainModels: Map<string, BaseLanguageModel>;
	langchainEmbeddings: Map<string, Embeddings>;
	langchainTools: Tool[];
	secrets: Map<string, string>;
	logger: Console;
	skipPersistence?: boolean; // Skip database persistence (for testing)
}

export type NodeExecutionMode = "execute" | "webhook" | "poll";

/**
 * Result of executing a single node
 */
export interface NodeExecutionResult {
	nodeId: string;
	nodeType: string;
	status: "success" | "error" | "skipped";
	// Execution metadata
	startTime: number;
	endTime: number;
	durationMs: number;
	// Data flow
	inputData: Record<string, unknown>; // Data received from upstream nodes
	data?: Record<string, INodeExecutionData[]>; // Result data per output handle (n8n: resultData)
	// Execution context
	error?: Error;
	events: StreamEvent[];
	/** Agent-specific: Internal trace of agent loop iterations */
	internalTrace?: InternalTraceData;
}

/**
 * Result of orchestrating a full workflow
 */
export interface OrchestrationResult {
	workflowId: string;
	runId: string;
	status: "success" | "error";
	nodeResults: Map<string, NodeExecutionResult>;
	finalOutputs: Record<string, unknown>;
	allEvents: StreamEvent[];
	errors: Array<{ nodeId?: string; error: Error }>;
	totalDurationMs: number;
	startTime: number;
	endTime: number;
}

// ============================================================================
// WORKFLOW ORCHESTRATOR
// ============================================================================

export class WorkflowOrchestrator {
	private state: Record<string, Record<string, unknown>> = {};
	private nodeResults: Map<string, NodeExecutionResult> = new Map();
	private allEvents: StreamEvent[] = [];
	private errors: Array<{ nodeId?: string; error: Error }> = [];

	/**
	 * Conversation memory scoped to this workflow run
	 * Shared across all agent nodes in the workflow
	 * Created at run start, destroyed at run end (not persisted)
	 *
	 * Note: Disabled for LangChain 1.0 - memory is now handled via LangGraph state
	 */
	// private conversationMemory?: BufferMemory;

	constructor(private config: OrchestrationConfig) {
		// Initialize memory if any agent node has memory input connected
		// Disabled for LangChain 1.0 upgrade
		// this.conversationMemory = this.initializeMemoryIfNeeded();
	}

	/**
	 * Check if any agent node has a memory input connected
	 * If so, create a BufferMemory instance for this run
	 *
	 * Note: Disabled for LangChain 1.0 - memory is now handled via LangGraph state
	 */
	/*
	private initializeMemoryIfNeeded(): BufferMemory | undefined {
		const { nodes } = this.config.definition;
		const { edges } = this.config.definition;

		// Check if any agent node has a memory connection
		const hasMemoryConnection = nodes.some((node) => {
			// Check if this is an agent node
			const nodeType = (node.data as any)?.nodeType || node.type;
			if (nodeType !== "agent") return false;

			// Check if any edge targets this node's memory input
			return edges.some(
				(edge) =>
					edge.target === node.id &&
					edge.targetHandle === "memory",
			);
		});

		if (hasMemoryConnection) {
			this.config.logger.info(
				`[ORCHESTRATOR] Initializing conversation memory for run ${this.config.runId}`,
			);

			return new BufferMemory({
				returnMessages: true,
				memoryKey: "chat_history",
			});
		}

		return undefined;
	}
	*/

	/**
	 * Execute the workflow
	 */
	async orchestrate(): Promise<OrchestrationResult> {
		const startTime = Date.now();

		try {
			this.config.logger.info(
				`[ORCHESTRATOR] Starting workflow: ${this.config.workflowId}`,
			);

			// Get execution order using topological sort
			const executionOrder = this.getExecutionOrder();
			this.config.logger.info(
				`[ORCHESTRATOR] Execution order: ${executionOrder.join(" -> ")}`,
			);

			// Execute each node
			for (const nodeId of executionOrder) {
				const node = this.config.definition.nodes.find(n => n.id === nodeId);

				if (!node) {
					const error = new Error(
						`Node ${nodeId} not found in workflow definition`,
					);
					this.errors.push({ nodeId, error });
					continue;
				}

				try {
					await this.executeNode(nodeId, node);
				} catch (error) {
					this.config.logger.error(
						`[ORCHESTRATOR] Node ${nodeId} execution failed:`,
						error,
					);
					this.errors.push({
						nodeId,
						error: error instanceof Error ? error : new Error(String(error)),
					});

					// Stop execution on error
					break;
				}
			}

			const endTime = Date.now();

			// Persist node executions to database
			await this.persistNodeExecutions();

			return {
				workflowId: this.config.workflowId,
				runId: this.config.runId,
				status: this.errors.length === 0 ? "success" : "error",
				nodeResults: this.nodeResults,
				finalOutputs: this.state,
				allEvents: this.allEvents,
				errors: this.errors,
				totalDurationMs: endTime - startTime,
				startTime,
				endTime,
			};
		} catch (error) {
			const endTime = Date.now();

			this.config.logger.error(
				`[ORCHESTRATOR] Workflow execution failed:`,
				error,
			);

			return {
				workflowId: this.config.workflowId,
				runId: this.config.runId,
				status: "error",
				nodeResults: this.nodeResults,
				finalOutputs: this.state,
				allEvents: this.allEvents,
				errors: [
					...this.errors,
					{
						error: error instanceof Error ? error : new Error(String(error)),
					},
				],
				totalDurationMs: endTime - startTime,
				startTime,
				endTime,
			};
		}
	}

	/**
	 * Execute a single node
	 *
	 * For agent nodes, this may involve multiple iterations of tool execution
	 */
	private async executeNode(nodeId: string, nodeData: any): Promise<void> {
		const startTime = Date.now();
		// Node type is stored in data.nodeType (or legacy data.nodeId for backward compatibility)
		const nodeType = nodeData.data?.nodeType || nodeData.data?.nodeId;
		const nodeVersion = nodeData.data?.nodeVersion || nodeData.version || 1;
		// Merge nodeInputs (connection-based) with propertyValues (user-entered in UI)
		const nodeParameters = {
			...(nodeData.data?.nodeInputs || {}),
			...(nodeData.data?.propertyValues || {}),
		};

		if (!nodeType) {
			throw new Error(`Node ${nodeId} is missing nodeType/nodeId in data. Node data: ${JSON.stringify(nodeData.data)}`);
		}

		this.config.logger.info(
			`[${nodeId}] Starting execution (type: ${nodeType})`,
		);

		// Get node implementation
		const nodeInstance = nodeRegistry.getNodeType(nodeType);

		if (!nodeInstance) {
			throw new Error(`Node type "${nodeType}" not found in registry`);
		}

		// Prepare input data
		const inputData = this.prepareInputData(nodeId);

		this.config.logger.debug(`[${nodeId}] Input data:`, inputData);

		// Create execution context
		const executeFunctions = new ExecuteFunctions(
			nodeId,
			nodeType,
			nodeVersion,
			this.config.runId,
			nodeParameters,
			inputData,
			{}, // nodeCredentials - TODO: Extract from node config
			this.state,
			this.config.langchainModels,
			this.config.langchainEmbeddings,
			this.config.langchainTools,
			this.config.secrets,
			this.config.logger,
		);

		try {
			// Execute the node
			if (!nodeInstance.execute) {
				throw new Error(
					`Node type "${nodeType}" does not support execute mode`,
				);
			}

			// Execute node
			// Agent nodes expect ExecutionContext, other nodes use ExecuteFunctions
			let result: any;

			if (nodeType === "agent") {
				// Agent nodes use ExecutionContext
				const abortController = new AbortController();
				const agentExecutionSteps: InternalStep[] = [];
				let currentIteration = 0;
				const maxIterations = (nodeParameters.maxIterations as number) || 10;

				const context = this.createExecutionContext(
					executeFunctions,
					undefined,
					abortController.signal,
				);
				result = await nodeInstance.execute(context as any);

				// Handle agent execution loop
				// If the node returns an EngineRequest, we need to execute tools and resume
				while (this.isEngineRequest(result)) {
					currentIteration++;

					// Check for abort before continuing
					if (abortController.signal.aborted) {
						throw new Error(`Agent execution cancelled for node ${nodeId}`);
					}

					// Check for max iterations
					if (currentIteration > maxIterations) {
						this.config.logger.warn(
							`[${nodeId}] Agent hit max iterations (${maxIterations})`,
						);
						break;
					}

					this.config.logger.info(
						`[${nodeId}] Agent iteration ${currentIteration}: ${result.actions.length} tool calls`,
					);

					// Collect agent planning step
					agentExecutionSteps.push({
						iteration: currentIteration,
						timestamp: Date.now(),
						type: "agent_plan",
						agentLog: `Agent planning ${result.actions.length} tool call(s)`,
					});

					// Execute tools via request handler
					const toolStartTime = Date.now();
					const response = await handleEngineRequest(result, {
						emit: (event) => {
							this.config.logger.debug(`[${nodeId}] Agent event:`, event);
						},
						signal: abortController.signal,
					});

					// Collect tool execution steps
					for (const action of result.actions) {
						const toolResult = response.results.find((r) => r.id === action.id);
						agentExecutionSteps.push({
							iteration: currentIteration,
							timestamp: Date.now(),
							type: "tool_call",
							toolName: action.tool,
							toolCallId: action.id,
							toolInput: action.input,
							toolOutput: toolResult?.output,
							toolError: toolResult?.error?.message,
							toolDurationMs: toolResult?.durationMs,
						});
					}

					this.config.logger.info(`[${nodeId}] Tools executed, resuming agent`);

					// Check for abort before resuming
					if (abortController.signal.aborted) {
						throw new Error(`Agent execution cancelled for node ${nodeId}`);
					}

					// Resume agent with tool results
					const resumeContext = this.createExecutionContext(
						executeFunctions,
						response,
						abortController.signal,
					);
					result = await nodeInstance.execute(resumeContext as any);
				}

				// Collect final step
				const finalOutput = result[0]?.[0]?.json?.output || "No output";
				agentExecutionSteps.push({
					iteration: currentIteration + 1,
					timestamp: Date.now(),
					type: "agent_finish",
					finalOutput: String(finalOutput),
				});

				// Store internal trace
				const internalTrace: InternalTraceData = {
					steps: agentExecutionSteps,
					iterationCount: currentIteration,
					finalState: currentIteration > maxIterations ? "max_iterations" : "success",
					halted: currentIteration > maxIterations,
					haltReason: currentIteration > maxIterations ? "max_iterations" : undefined,
				};

				// Convert agent result to outputs format
				// Agent returns INodeExecutionData[][], we need to store as outputs
				const agentOutputData = result as INodeExecutionData[][];
				if (agentOutputData && agentOutputData[0]) {
					executeFunctions.setOutput('main', agentOutputData[0]);
				}

				// Collect outputs and store with trace
				const outputs = executeFunctions.getCollectedOutputs();
				const events = executeFunctions.getCollectedEvents();
				this.state[nodeId] = outputs;

				const endTime = Date.now();
				this.nodeResults.set(nodeId, {
					nodeId,
					nodeType,
					status: "success",
					inputData: inputData as Record<string, unknown>,
					data: outputs,
					internalTrace, // NEW: Store agent's internal trace
					events,
					durationMs: endTime - startTime,
					startTime,
					endTime,
				});

				this.allEvents.push(...events);
				this.config.logger.debug(`[${nodeId}] Agent execution complete with trace`);
				return; // Early return after agent handling
			} else {
				// Regular nodes use ExecuteFunctions
				result = await nodeInstance.execute(executeFunctions as any);
			}

			this.config.logger.info(`[${nodeId}] Execution successful`);

			// Collect outputs
			let outputs = executeFunctions.getCollectedOutputs();

			// If node returned data directly (legacy pattern), convert it
			if (result && Array.isArray(result) && result.length > 0) {
				// result is [[{ json: {...} }]] format
				if (!outputs.main || outputs.main.length === 0) {
					executeFunctions.setOutput('main', result[0]);
					outputs = executeFunctions.getCollectedOutputs();
				}
			}

			const events = executeFunctions.getCollectedEvents();

			// Store node state for downstream nodes
			this.state[nodeId] = outputs;

			// Track execution result
			const endTime = Date.now();

			this.nodeResults.set(nodeId, {
				nodeId,
				nodeType,
				status: "success",
				inputData: inputData as Record<string, unknown>,
				data: outputs,
				events,
				durationMs: endTime - startTime,
				startTime,
				endTime,
			});

			// Collect events
			this.allEvents.push(...events);

			this.config.logger.debug(`[${nodeId}] Outputs:`, outputs);
		} catch (error) {
			const endTime = Date.now();

			this.config.logger.error(`[${nodeId}] Execution failed:`, error);

			this.nodeResults.set(nodeId, {
				nodeId,
				nodeType,
				status: "error",
				inputData: inputData as Record<string, unknown>,
				error: error instanceof Error ? error : new Error(String(error)),
				events: [],
				durationMs: endTime - startTime,
				startTime,
				endTime,
			});

			throw error;
		}
	}

	/**
	 * Type guard to check if result is an EngineRequest
	 */
	private isEngineRequest(
		result: any,
	): result is EngineRequest<RequestResponseMetadata> {
		return (
			result &&
			typeof result === "object" &&
			"actions" in result &&
			"metadata" in result &&
			Array.isArray(result.actions)
		);
	}

	/**
	 * Create ExecutionContext from ExecuteFunctions (adapter pattern)
	 *
	 * This bridges the gap between our legacy ExecuteFunctions interface
	 * and the modern ExecutionContext used by agent nodes.
	 */
	private createExecutionContext(
		executeFunctions: ExecuteFunctions,
		resumeData?: any,
		signal?: AbortSignal,
	): IExecutionContext {
		// Access private fields via any cast (temporary solution)
		const ef = executeFunctions as any;

		// Build ExecutionContext with helper methods
		const context: IExecutionContext = {
			nodeId: ef.nodeId,
			nodeType: ef.nodeType,
			version: ef.nodeVersion,
			inputs: executeFunctions.getInputData(),
			properties: executeFunctions.getNodeParameters(),
			evaluatedProperties: executeFunctions.getNodeParameters(), // Already evaluated
			credentials: {}, // TODO: Extract credentials from executeFunctions
			signal: signal || new AbortController().signal,
			engineResponse: resumeData, // Add engineResponse if resuming agent

			// Execution tracking (stub for future multi-run/item-based)
			runIndex: 0,
			itemIndex: 0,

			// Helper methods (delegate to ExecuteFunctions)
			getInputData: () => {
				const inputData = executeFunctions.getInputData();
				return Object.values(inputData).flat() as any[];
			},
			getInputByHandle: (handle: string) => {
				return executeFunctions.getInputByHandle(handle) as any;
			},
			getNodeParameter: <T = any>(name: string, defaultValue?: T): T => {
				return executeFunctions.getNodeParameter(name, defaultValue) as T;
			},
		};

		return context;
	}

	/**
	 * Get input data for a node from connected nodes and {{variable}} resolution
	 */
	private prepareInputData(
		nodeId: string,
	): Record<string, INodeExecutionData[]> {
		const node = this.config.definition.nodes.find(n => n.id === nodeId);
		const nodeInputs = (node?.data as any)?.nodeInputs || {};

		// Resolve inputs using InputResolver
		// This handles both direct edge connections and {{variable}} placeholders
		const resolvedInputs = resolveInputs({
			nodeInputs,
			nodeId,
			edges: this.config.definition.edges,
			state: this.state as Record<string, Record<string, INodeExecutionData[]>>,
			logger: this.config.logger,
		});

		// Convert resolved inputs to the format expected by ExecuteFunctions
		const inputData: Record<string, INodeExecutionData[]> = {};

		// First, collect direct edge connections
		for (const edge of this.config.definition.edges) {
			if (edge.target === nodeId) {
				const sourceNodeId = edge.source;
				const targetHandle = edge.targetHandle || "default";
				const sourceHandle = edge.sourceHandle || "output";

				if (sourceNodeId in this.state) {
					const sourceOutputs = this.state[sourceNodeId];

					// Get the output from the specific handle
					const outputData = sourceOutputs[sourceHandle];

					if (outputData !== undefined) {
						inputData[targetHandle] = Array.isArray(outputData)
							? outputData
							: [outputData];
					}
				}
			}
		}

		// Then, add resolved parameters as "param" input
		// These come from {{variable}} resolution
		if (Object.keys(resolvedInputs).length > 0) {
			inputData["params"] = [resolvedInputs];
		}

		return inputData;
	}

	/**
	 * Get execution order using topological sort (Kahn's algorithm)
	 */
	private getExecutionOrder(): string[] {
		const nodes = this.config.definition.nodes.map(n => n.id);
		const edges = this.config.definition.edges;

		// Build adjacency list and in-degree map
		const inDegree = new Map<string, number>();
		const adjacency = new Map<string, string[]>();

		// Initialize
		for (const nodeId of nodes) {
			inDegree.set(nodeId, 0);
			adjacency.set(nodeId, []);
		}

		// Build graph
		for (const edge of edges) {
			const current = inDegree.get(edge.target) || 0;
			inDegree.set(edge.target, current + 1);

			const deps = adjacency.get(edge.source) || [];
			deps.push(edge.target);
			adjacency.set(edge.source, deps);
		}

		// Kahn's algorithm
		const queue: string[] = [];

		for (const nodeId of nodes) {
			if (inDegree.get(nodeId) === 0) {
				queue.push(nodeId);
			}
		}

		const order: string[] = [];

		while (queue.length > 0) {
			const nodeId = queue.shift()!;
			order.push(nodeId);

			const dependents = adjacency.get(nodeId) || [];

			for (const dependent of dependents) {
				const degree = inDegree.get(dependent) || 0;
				inDegree.set(dependent, degree - 1);

				if (inDegree.get(dependent) === 0) {
					queue.push(dependent);
				}
			}
		}

		if (order.length !== nodes.length) {
			this.config.logger.error('[ORCHESTRATOR] Topological sort failed:', {
				nodesCount: nodes.length,
				orderCount: order.length,
				nodes,
				edges,
				inDegree: Array.from(inDegree.entries()),
			});
			throw new Error("Workflow contains a cycle or is invalid");
		}

		return order;
	}

	/**
	 * Persist node execution results to database
	 */
	private async persistNodeExecutions(): Promise<void> {
		// Skip persistence if configured (e.g., for node testing)
		if (this.config.skipPersistence) {
			this.config.logger.debug('[ORCHESTRATOR] Skipping database persistence (skipPersistence=true)');
			return;
		}

		try {
			for (const [nodeId, result] of this.nodeResults.entries()) {
				await db.insert(nodeExecutions).values({
					runId: this.config.runId,
					nodeId,
					nodeType: result.nodeType,
					status: result.status,
					inputs: result.inputData as any,
					outputs: result.data as any,
					internalTrace: result.internalTrace,
					startedAt: new Date(result.startTime),
					completedAt: new Date(result.endTime),
					errorMessage: result.status === 'error' ? 'Execution failed' : undefined,
				});
			}
			this.config.logger.info(`[ORCHESTRATOR] Persisted ${this.nodeResults.size} node execution(s) to database`);
		} catch (error) {
			this.config.logger.error('[ORCHESTRATOR] Failed to persist node executions:', error);
			// Don't throw - persistence failure shouldn't break workflow execution
		}
	}
}
