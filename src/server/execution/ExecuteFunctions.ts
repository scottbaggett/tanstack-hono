/**
 * Implementation of IExecuteFunctions
 *
 * This is what gets passed to nodes during execution.
 * It bridges the workflow executor with the node's needs.
 */

import type { BaseLanguageModel } from "@langchain/core/language_models/base";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Tool } from "@langchain/core/tools";

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeOutputData,
	StreamEventType,
	StreamEvent,
} from "../../types/execution";
import { extractDynamicInputHandles } from "./InputResolver";

/**
 * Implementation of IExecuteFunctions
 *
 * Passed to nodes during execution.
 */
export class ExecuteFunctions implements IExecuteFunctions {
	private outputs: INodeOutputData = {};
	private events: StreamEvent[] = [];

	// Index signature to match interface
	[key: string]: unknown;

	constructor(
		private nodeId: string,
		private nodeType: string,
		private nodeVersion: number,
		private runId: string,
		private nodeParameters: Record<string, unknown>,
		private inputData: Record<string, INodeExecutionData[]>,
		private state: Record<string, unknown>,
		private langchainModels: Map<string, BaseLanguageModel>,
		private langchainEmbeddings: Map<string, Embeddings>,
		private langchainTools: Tool[],
		private secrets: Map<string, string>,
		private logger: Console
	) {}

	// === Node Configuration ===

	getNodeParameter(name: string, defaultValue?: unknown): unknown {
		return this.nodeParameters[name] ?? defaultValue;
	}

	getNodeParameters(): Record<string, unknown> {
		return { ...this.nodeParameters };
	}

	// === Input Data ===

	getInputData(): Record<string, INodeExecutionData[]> {
		return { ...this.inputData };
	}

	getInputByHandle(handleName: string): INodeExecutionData[] | undefined {
		return this.inputData[handleName];
	}

	getInputValue(handleName: string): INodeExecutionData | undefined {
		const data = this.inputData[handleName];
		return data?.[0];
	}

	// === LangChain Integration ===

	getLangchainModel(modelName?: string): BaseLanguageModel {
		const name = modelName || "default";
		const model = this.langchainModels.get(name);

		if (!model) {
			throw new Error(
				`LangChain model "${name}" not found. Available models: ${Array.from(this.langchainModels.keys()).join(", ")}`
			);
		}

		return model;
	}

	getLangchainEmbeddings(embeddingsName?: string): Embeddings {
		const name = embeddingsName || "default";
		const embeddings = this.langchainEmbeddings.get(name);

		if (!embeddings) {
			throw new Error(
				`LangChain embeddings "${name}" not found. Available: ${Array.from(this.langchainEmbeddings.keys()).join(", ")}`
			);
		}

		return embeddings;
	}

	getLangchainTools(): Tool[] {
		return [...this.langchainTools];
	}

	getLangchainTool(toolName: string): Tool | undefined {
		return this.langchainTools.find((t) => t.name === toolName);
	}

	// === Primitives: HTTP/Network ===

	async httpRequest(options: {
		url: string;
		method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
		headers?: Record<string, string>;
		body?: unknown;
		timeout?: number;
	}): Promise<{
		status: number;
		headers: Record<string, string>;
		data: unknown;
		text: string;
	}> {
		const method = options.method || "GET";
		const timeout = options.timeout || 30000;

		this.logger.info(`[${this.nodeId}] HTTP ${method} ${options.url}`);

		try {
			const fetchOptions: RequestInit = {
				method,
				headers: options.headers || {},
				signal: AbortSignal.timeout(timeout),
			};

			if (options.body !== undefined) {
				fetchOptions.body =
					typeof options.body === "string" ? options.body : JSON.stringify(options.body);

				// Set Content-Type if not provided
				if (!fetchOptions.headers?.["Content-Type"]) {
					(fetchOptions.headers as Record<string, string>)["Content-Type"] =
						"application/json";
				}
			}

			const response = await fetch(options.url, fetchOptions);
			const text = await response.text();

			// Try to parse as JSON, fallback to text
			let data: unknown = text;

			try {
				data = JSON.parse(text);
			} catch {
				// Keep as text
			}

			return {
				status: response.status,
				headers: Object.fromEntries(response.headers.entries()),
				data,
				text,
			};
		} catch (error) {
			this.logger.error(`[${this.nodeId}] HTTP request failed:`, error);

			throw error;
		}
	}

	// === Primitives: Code Execution ===

	async executeSandboxedCode(options: {
		language: "python" | "javascript" | "bash";
		code: string;
		timeout?: number;
		environment?: Record<string, string>;
		requirements?: string[];
		input?: Record<string, unknown>;
	}): Promise<{
		success: boolean;
		output: unknown;
		stderr?: string;
		duration: number;
	}> {
		const timeout = options.timeout || 30000;
		const startTime = Date.now();

		this.logger.info(`[${this.nodeId}] Executing ${options.language} code`);

		try {
			let result: { stdout: string; stderr: string };

			if (options.language === "javascript") {
				result = await this.executeJavaScript(options.code, options.input || {}, timeout);
			} else if (options.language === "python") {
				result = await this.executePython(
					options.code,
					options.requirements || [],
					options.input || {},
					timeout
				);
			} else if (options.language === "bash") {
				result = await this.executeBash(options.code, options.environment || {}, timeout);
			} else {
				throw new Error(`Unsupported language: ${options.language}`);
			}

			const duration = Date.now() - startTime;

			// Try to parse output as JSON
			let output: unknown = result.stdout;

			try {
				output = JSON.parse(result.stdout);
			} catch {
				// Keep as string
			}

			return {
				success: result.stderr === "",
				output,
				stderr: result.stderr || undefined,
				duration,
			};
		} catch (error) {
			const duration = Date.now() - startTime;

			this.logger.error(`[${this.nodeId}] Code execution failed:`, error);

			return {
				success: false,
				output: null,
				stderr: error instanceof Error ? error.message : String(error),
				duration,
			};
		}
	}

	private executeJavaScript(
		code: string,
		input: Record<string, unknown>,
		timeout: number
	): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			try {
				// Create a wrapper that captures output
				let stdout = "";
				let stderr = "";

				const originalLog = console.log;
				const originalError = console.error;

				console.log = (...args: unknown[]) => {
					stdout += args.map((a) => String(a)).join(" ") + "\n";
				};

				console.error = (...args: unknown[]) => {
					stderr += args.map((a) => String(a)).join(" ") + "\n";
				};

				const timeoutId = setTimeout(() => {
					console.log = originalLog;
					console.error = originalError;
					reject(new Error(`JavaScript execution timeout after ${timeout}ms`));
				}, timeout);

				try {
					// Create function with input parameters
					const paramNames = Object.keys(input);
					const paramValues = Object.values(input);
					const func = new Function(...paramNames, code);

					const result = func(...paramValues);

					clearTimeout(timeoutId);

					// If result is a Promise, await it
					if (result instanceof Promise) {
						result
							.then((resolvedValue) => {
								stdout += JSON.stringify(resolvedValue);
								console.log = originalLog;
								console.error = originalError;
								resolve({ stdout, stderr });
							})
							.catch((error) => {
								stderr += error instanceof Error ? error.message : String(error);
								console.log = originalLog;
								console.error = originalError;
								resolve({ stdout, stderr });
							});
					} else {
						stdout += JSON.stringify(result);
						console.log = originalLog;
						console.error = originalError;
						resolve({ stdout, stderr });
					}
				} catch (error) {
					clearTimeout(timeoutId);

					stderr += error instanceof Error ? error.message : String(error);
					console.log = originalLog;
					console.error = originalError;
					resolve({ stdout, stderr });
				}
			} catch (error) {
				reject(error);
			}
		});
	}

	private executePython(
		code: string,
		requirements: string[],
		input: Record<string, unknown>,
		timeout: number
	): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			// Prepare Python script with input data injected
			const inputJson = JSON.stringify(input);

			const pythonCode = `
import json
import sys

# Inject input data
_input = json.loads('''${inputJson}''')
${Object.keys(input)
	.map((key) => `${key} = _input.get('${key}')`)
	.join("\n")}

# User code
${code}
`;

			const process = spawn("python3", ["-c", pythonCode], {
				timeout,
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			process.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			process.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			process.on("close", (code) => {
				resolve({ stdout, stderr });
			});

			process.on("error", (error) => {
				stderr += error.message;
				resolve({ stdout, stderr });
			});

			setTimeout(() => {
				if (!process.killed) {
					process.kill();
					stderr = `Python execution timeout after ${timeout}ms`;
				}
			}, timeout);
		});
	}

	private executeBash(
		code: string,
		environment: Record<string, string>,
		timeout: number
	): Promise<{ stdout: string; stderr: string }> {
		return new Promise((resolve) => {
			const env: Record<string, string> = {
				...(process.env as unknown as Record<string, string>),
				...environment,
			};

			const process = spawn("bash", ["-c", code], {
				timeout,
				stdio: ["pipe", "pipe", "pipe"],
				env: env as NodeJS.ProcessEnv,
			});

			let stdout = "";
			let stderr = "";

			process.stdout?.on("data", (data: Buffer) => {
				stdout += data.toString();
			});

			process.stderr?.on("data", (data: Buffer) => {
				stderr += data.toString();
			});

			process.on("close", () => {
				resolve({ stdout, stderr });
			});

			process.on("error", (error: Error) => {
				stderr += error.message;
				resolve({ stdout, stderr });
			});

			setTimeout(() => {
				if (!process.killed) {
					process.kill();
					stderr = `Bash execution timeout after ${timeout}ms`;
				}
			}, timeout);
		});
	}

	// === Primitives: File System ===

	async readFile(filePath: string): Promise<string | Buffer> {
		// Security: Only allow reads within workspace
		const absolutePath = path.resolve(process.cwd(), filePath);
		const workspacePath = path.resolve(process.cwd());

		if (!absolutePath.startsWith(workspacePath)) {
			throw new Error(`Access denied: Cannot read file outside workspace: ${filePath}`);
		}

		this.logger.info(`[${this.nodeId}] Reading file: ${filePath}`);

		try {
			const content = await fs.readFile(absolutePath);

			return content;
		} catch (error) {
			this.logger.error(`[${this.nodeId}] File read failed:`, error);

			throw error;
		}
	}

	async writeFile(filePath: string, data: string | Buffer): Promise<void> {
		// Security: Only allow writes within workspace
		const absolutePath = path.resolve(process.cwd(), filePath);
		const workspacePath = path.resolve(process.cwd());

		if (!absolutePath.startsWith(workspacePath)) {
			throw new Error(`Access denied: Cannot write file outside workspace: ${filePath}`);
		}

		this.logger.info(`[${this.nodeId}] Writing file: ${filePath}`);

		try {
			// Ensure directory exists
			const dir = path.dirname(absolutePath);

			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(absolutePath, data);
		} catch (error) {
			this.logger.error(`[${this.nodeId}] File write failed:`, error);

			throw error;
		}
	}

	// === Secrets ===

	async getSecret(secretName: string): Promise<string | undefined> {
		// In production, this would decrypt from a secrets manager
		return this.secrets.get(secretName);
	}

	// === Output ===

	setOutputData(outputData: INodeOutputData): void {
		this.outputs = outputData;
	}

	setOutput(handleName: string, data: INodeExecutionData[]): void {
		this.outputs[handleName] = data;
	}

	// === Streaming & Events ===

	emitStreamEvent(eventType: StreamEventType, data: Record<string, unknown>): void {
		const event: StreamEvent = {
			type: eventType,
			timestamp: Date.now(),
			data,
			nodeId: this.nodeId,
			runId: this.runId,
		};

		this.events.push(event);
		this.logger.debug(`[${this.nodeId}] Stream event: ${eventType}`, data);
	}

	emitEvent(event: StreamEvent): void {
		const enrichedEvent = {
			...event,
			nodeId: this.nodeId,
			runId: this.runId,
		};

		this.events.push(enrichedEvent);
		this.logger.debug(`[${this.nodeId}] Event: ${event.type}`, event.data);
	}

	// === Logging ===

	log(level: "info" | "warn" | "error", message: string, data?: unknown): void {
		const prefix = `[${this.nodeId}]`;

		switch (level) {
			case "info":
				this.logger.info(prefix, message, data);
				break;
			case "warn":
				this.logger.warn(prefix, message, data);
				break;
			case "error":
				this.logger.error(prefix, message, data);
				break;
		}
	}

	logInfo(message: string, data?: unknown): void {
		this.log("info", message, data);
	}

	logWarn(message: string, data?: unknown): void {
		this.log("warn", message, data);
	}

	logError(message: string, data?: unknown): void {
		this.log("error", message, data);
	}

	// === Run Metadata ===

	getRunId(): string {
		return this.runId;
	}

	getNodeId(): string {
		return this.nodeId;
	}

	getNodeType(): string {
		return this.nodeType;
	}

	getNodeVersion(): number {
		return this.nodeVersion;
	}

	// === Dynamic Input Discovery ===

	/**
	 * Get dynamic input handles that are inferred from node configuration
	 *
	 * For nodes that use {{variable}} placeholders, this extracts
	 * all variable names and exposes them as potential input handles.
	 *
	 * @example
	 * If nodeParameters = { prompt: "Hello {{name}}, you have {{count}} items" }
	 * Returns: ["name", "count"]
	 *
	 * These become connectible input handles in the workflow UI.
	 */
	getDynamicInputHandles(): string[] {
		return extractDynamicInputHandles(this.nodeParameters);
	}

	// === Getters for orchestrator ===

	getCollectedOutputs(): INodeOutputData {
		return this.outputs;
	}

	getCollectedEvents(): StreamEvent[] {
		return this.events;
	}
}
