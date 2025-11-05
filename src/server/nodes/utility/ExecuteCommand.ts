/**
 * Execute Command Node
 *
 * Executes shell commands and returns the result
 * Perfect for testing expression system
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
	IExecutionContext,
	INodeExecutionData,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
} from "@/types/interfaces";

const execAsync = promisify(exec);

const baseDescription: INodeTypeBaseDescription = {
	displayName: "Execute Command",
	name: "executeCommand",
	icon: "terminal",
	iconColor: "standard-gray",
	category: "utility",
	description: "Execute shell commands and capture output",
	codex: {
		alias: ["Shell", "Terminal", "Command", "Exec"],
		categories: ["utility"],
		subcategories: {
			utility: ["System"],
		},
	},
};

export class ExecuteCommand implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: "Execute Command",
				color: "standard-gray",
			},
			maxInputs: 1,
			maxOutputs: 1,
			properties: [
				{
					displayName: "Command",
					name: "command",
					type: "string",
					default: 'echo "Hello World"',
					description:
						"The shell command to execute. Use expressions like {{ TextInput.$json.text }}",
					placeholder: 'echo "Hello"',
				},
				{
					displayName: "Timeout (ms)",
					name: "timeout",
					type: "number",
					default: 5000,
					description: "Maximum time to wait for command execution",
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		const command =
			(context.evaluatedProperties.command as string) || 'echo "No command"';
		const timeout = (context.evaluatedProperties.timeout as number) || 5000;

		try {
			const { stdout, stderr } = await execAsync(command, {
				timeout,
				maxBuffer: 1024 * 1024, // 1MB max output
			});

			return [
				[
					{
						json: {
							exitCode: 0,
							stdout: stdout.trim(),
							stderr: stderr.trim(),
							command,
						},
					},
				],
			];
		} catch (error: any) {
			// Command failed or timed out
			return [
				[
					{
						json: {
							exitCode: error.code || 1,
							stdout: error.stdout?.trim() || "",
							stderr: error.stderr?.trim() || error.message,
							command,
							error: error.message,
						},
					},
				],
			];
		}
	}
}
