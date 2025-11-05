/**
 * Event Emitter for Agent Observability
 *
 * Structured event emission for agent execution
 * Enables debugging, monitoring, and LangSmith integration
 */

import type { AgentEvent } from "@/server/types/agent";

// ============================================================================
// Event Emitter Interface
// ============================================================================

export type EventHandler = (event: AgentEvent) => void | Promise<void>;

export interface EventEmitterOptions {
	/** Enable console logging of events */
	logToConsole?: boolean;
	/** Enable LangSmith integration */
	langsmith?: boolean;
	/** Custom event handlers */
	handlers?: EventHandler[];
}

// ============================================================================
// Event Emitter
// ============================================================================

export class AgentEventEmitter {
	private handlers: EventHandler[] = [];
	private options: EventEmitterOptions;

	constructor(options: EventEmitterOptions = {}) {
		this.options = {
			logToConsole: true, // Default: enabled
			langsmith: false, // Default: disabled (requires setup)
			...options,
		};

		// Add console logger if enabled
		if (this.options.logToConsole) {
			this.handlers.push(consoleEventHandler);
		}

		// Add custom handlers
		if (this.options.handlers) {
			this.handlers.push(...this.options.handlers);
		}

		// Add LangSmith handler if enabled
		if (this.options.langsmith) {
			// TODO: Integrate LangSmith when ready
			// this.handlers.push(langsmithEventHandler);
		}
	}

	/**
	 * Emit an event to all registered handlers
	 */
	emit(event: AgentEvent): void {
		for (const handler of this.handlers) {
			try {
				const result = handler(event);
				if (result instanceof Promise) {
					result.catch((error) => {
						console.error("[EventEmitter] Handler error:", error);
					});
				}
			} catch (error) {
				console.error("[EventEmitter] Handler error:", error);
			}
		}
	}

	/**
	 * Add a custom event handler
	 */
	addHandler(handler: EventHandler): void {
		this.handlers.push(handler);
	}

	/**
	 * Remove a custom event handler
	 */
	removeHandler(handler: EventHandler): void {
		this.handlers = this.handlers.filter((h) => h !== handler);
	}

	/**
	 * Create a scoped emit function for tool context
	 */
	createEmitFunction(): (event: AgentEvent) => void {
		return (event) => this.emit(event);
	}
}

// ============================================================================
// Console Event Handler
// ============================================================================

/**
 * Logs events to console with structured JSON format
 */
function consoleEventHandler(event: AgentEvent): void {
	const timestamp = new Date().toISOString();
	const logEntry = { timestamp, ...event };

	// Color-coded log levels
	switch (event.t) {
		case "agent.plan":
			console.log("[AGENT]", JSON.stringify(logEntry, null, 2));
			break;

		case "engine.request":
			console.log("[ENGINE]", JSON.stringify(logEntry, null, 2));
			break;

		case "tool.start":
			console.log(
				"[TOOL]",
				`Starting ${event.tool}:`,
				JSON.stringify(logEntry, null, 2),
			);
			break;

		case "tool.success":
			console.log(
				"[TOOL]",
				`✓ ${event.tool} (${event.ms}ms, ${event.size} bytes)`,
				JSON.stringify(logEntry, null, 2),
			);
			break;

		case "tool.error":
			console.error(
				"[TOOL]",
				`✗ ${event.tool} failed:`,
				event.error.message,
				JSON.stringify(logEntry, null, 2),
			);
			break;

		case "agent.finish":
			console.log(
				"[AGENT]",
				`Finished (${event.iteration} iterations, ${event.finalState})`,
				JSON.stringify(logEntry, null, 2),
			);
			break;

		default:
			console.log("[EVENT]", JSON.stringify(logEntry, null, 2));
	}
}

// ============================================================================
// LangSmith Event Handler (Placeholder)
// ============================================================================

/**
 * TODO: Integrate with LangSmith for tracing
 *
 * Installation:
 * npm install @langchain/langsmith
 *
 * Setup:
 * export LANGCHAIN_TRACING_V2=true
 * export LANGCHAIN_API_KEY=your-api-key
 *
 * Integration example:
 *
 * import { Client } from '@langchain/langsmith';
 *
 * async function langsmithEventHandler(event: AgentEvent): Promise<void> {
 *   const client = new Client();
 *
 *   switch (event.t) {
 *     case 'agent.plan':
 *       await client.createRun({
 *         name: 'agent_plan',
 *         run_type: 'chain',
 *         inputs: { iteration: event.iteration },
 *         outputs: { actions: event.actions },
 *       });
 *       break;
 *
 *     case 'tool.start':
 *       await client.createRun({
 *         name: `tool_${event.tool}`,
 *         run_type: 'tool',
 *         inputs: event.input,
 *       });
 *       break;
 *
 *     case 'tool.success':
 *       // Update run with outputs
 *       break;
 *
 *     case 'tool.error':
 *       // Update run with error
 *       break;
 *   }
 * }
 */

// ============================================================================
// Event Filtering
// ============================================================================

/**
 * Creates a handler that only processes specific event types
 */
export function createFilteredHandler(
	types: AgentEvent["t"][],
	handler: EventHandler,
): EventHandler {
	return (event) => {
		if (types.includes(event.t)) {
			return handler(event);
		}
	};
}

/**
 * Example: Only log errors
 *
 * const errorOnlyHandler = createFilteredHandler(['tool.error'], (event) => {
 *   if (event.t === 'tool.error') {
 *     console.error('Tool error:', event.error);
 *   }
 * });
 */

// ============================================================================
// Event Aggregation
// ============================================================================

/**
 * Aggregates events for summary reporting
 */
export class EventAggregator {
	private events: AgentEvent[] = [];

	handler: EventHandler = (event) => {
		this.events.push(event);
	};

	/**
	 * Get all collected events
	 */
	getEvents(): AgentEvent[] {
		return [...this.events];
	}

	/**
	 * Get summary statistics
	 */
	getSummary() {
		const toolCalls = this.events.filter((e) => e.t === "tool.start").length;
		const toolSuccesses = this.events.filter(
			(e) => e.t === "tool.success",
		).length;
		const toolErrors = this.events.filter((e) => e.t === "tool.error").length;

		const totalMs = this.events
			.filter((e) => e.t === "tool.success")
			.reduce((sum, e) => sum + (e.t === "tool.success" ? e.ms : 0), 0);

		const totalSize = this.events
			.filter((e) => e.t === "tool.success")
			.reduce((sum, e) => sum + (e.t === "tool.success" ? e.size : 0), 0);

		return {
			toolCalls,
			toolSuccesses,
			toolErrors,
			totalDurationMs: totalMs,
			totalOutputBytes: totalSize,
			successRate: toolCalls > 0 ? (toolSuccesses / toolCalls) * 100 : 0,
		};
	}

	/**
	 * Clear collected events
	 */
	clear(): void {
		this.events = [];
	}
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Create a default event emitter instance
 */
export function createEventEmitter(
	options?: EventEmitterOptions,
): AgentEventEmitter {
	return new AgentEventEmitter(options);
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Basic usage
 *
 * const emitter = createEventEmitter();
 *
 * emitter.emit({
 *   t: 'tool.start',
 *   tool: 'calculator' as ToolName,
 *   id: 'call_123',
 *   input: { expression: '2+2' }
 * });
 *
 * emitter.emit({
 *   t: 'tool.success',
 *   tool: 'calculator' as ToolName,
 *   id: 'call_123',
 *   size: 42,
 *   ms: 100
 * });
 */

/**
 * Example: Custom handler
 *
 * const emitter = createEventEmitter({
 *   handlers: [
 *     (event) => {
 *       if (event.t === 'tool.error') {
 *         // Send alert to monitoring system
 *         sendAlert({ message: event.error.message });
 *       }
 *     }
 *   ]
 * });
 */

/**
 * Example: Event aggregation
 *
 * const aggregator = new EventAggregator();
 * const emitter = createEventEmitter({
 *   handlers: [aggregator.handler]
 * });
 *
 * // ... execute agent ...
 *
 * const summary = aggregator.getSummary();
 * console.log('Agent execution summary:', summary);
 * // { toolCalls: 3, toolSuccesses: 2, toolErrors: 1, ... }
 */
