/**
 * Webhook Trigger Node
 *
 * Receives HTTP requests and triggers workflow execution
 * Supports GET, POST, PUT, DELETE, PATCH methods
 * Returns request body, headers, query params, and path
 */

import type {
	IExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	INodeExecutionData,
} from "@/types/interfaces";

const baseDescription: INodeTypeBaseDescription = {
	displayName: "Webhook",
	name: "webhook",
	icon: "webhook",
	iconColor: "standard-purple",
	category: "trigger",
	description: "Receive data via webhook HTTP request",
	codex: {
		alias: ["HTTP", "API", "Trigger", "Webhook"],
		categories: ["trigger"],
		subcategories: {
			trigger: ["HTTP"],
		},
	},
};

export class Webhook implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: "Webhook",
				color: "standard-purple",
			},
			maxInputs: 0, // Trigger nodes have no inputs
			maxOutputs: 1,
			properties: [
				{
					displayName: "HTTP Method",
					name: "httpMethod",
					type: "select",
					default: "POST",
					description: "The HTTP method to listen for",
					options: [
						{ name: "GET", value: "GET" },
						{ name: "POST", value: "POST" },
						{ name: "PUT", value: "PUT" },
						{ name: "PATCH", value: "PATCH" },
						{ name: "DELETE", value: "DELETE" },
						{ name: "HEAD", value: "HEAD" },
						{ name: "OPTIONS", value: "OPTIONS" },
					],
				},
				{
					displayName: "Path",
					name: "path",
					type: "string",
					default: "",
					placeholder: "webhook-path",
					description:
						"The path to listen on (e.g., webhook-path). Leave empty for auto-generated path.",
				},
				{
					displayName: "Response Mode",
					name: "responseMode",
					type: "select",
					default: "onReceived",
					description: "When to respond to the webhook request",
					options: [
						{
							name: "On Received",
							value: "onReceived",
							description: "Respond immediately when request is received",
						},
						{
							name: "When Last Node Finishes",
							value: "lastNode",
							description: "Respond after workflow completes",
						},
					],
				},
				{
					displayName: "Response Code",
					name: "responseCode",
					type: "number",
					default: 200,
					description: "The HTTP response code to return",
				},
				{
					displayName: "Response Data",
					name: "responseData",
					type: "select",
					default: "firstEntryJson",
					description: "What data to return in the response",
					options: [
						{
							name: "First Entry JSON",
							value: "firstEntryJson",
							description: "Return the first entry's JSON data",
						},
						{
							name: "All Entries",
							value: "allEntries",
							description: "Return all entries as an array",
						},
						{
							name: "No Data",
							value: "noData",
							description: "Return success status only",
						},
					],
					displayOptions: {
						show: {
							responseMode: ["lastNode"],
						},
					},
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		// For webhook triggers, the execution is handled by the webhook route
		// This method is called when manually executing or testing the node
		// In production, webhook data comes from the HTTP request

		const httpMethod = (context.evaluatedProperties.httpMethod as string) || "POST";
		const path = (context.evaluatedProperties.path as string) || "";
		const responseMode = context.evaluatedProperties.responseMode as string;

		// Get webhook data from execution context if available
		const webhookData = (context as any).webhookData || {
			body: {},
			headers: {},
			query: {},
			params: {},
			method: httpMethod,
			path: path || "test-webhook",
		};

		// Return webhook data as node output
		const output = {
			body: webhookData.body || {},
			headers: webhookData.headers || {},
			query: webhookData.query || {},
			params: webhookData.params || {},
			method: webhookData.method || httpMethod,
			path: webhookData.path || path,
			timestamp: new Date().toISOString(),
		};

		return [
			[
				{
					json: output,
				},
			],
		];
	}

	// Webhook-specific method to get the webhook URL
	getWebhookUrl(workflowId: string, nodeId: string, path?: string): string {
		const baseUrl = process.env.WEBHOOK_URL || "http://localhost:3000";
		const webhookPath = path || `${workflowId}/${nodeId}`;
		return `${baseUrl}/webhook/${webhookPath}`;
	}
}
