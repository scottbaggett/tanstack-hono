/**
 * HTTP Request Node
 *
 * Makes HTTP requests to external APIs
 * Supports GET, POST, PUT, DELETE, PATCH and other methods
 * Inspired by n8n's HTTP Request node
 */

import type {
	IExecutionContext,
	INodeType,
	INodeTypeBaseDescription,
	INodeTypeDescription,
	INodeExecutionData,
} from '@/types/interfaces';

const baseDescription: INodeTypeBaseDescription = {
	displayName: 'HTTP Request',
	name: 'httpRequest',
	icon: 'globe',
	iconColor: 'standard-blue',
	category: 'utility',
	description: 'Make HTTP requests to external APIs',
	codex: {
		alias: ['HTTP', 'API', 'REST', 'Fetch', 'Request'],
		categories: ['utility'],
		subcategories: {
			utility: ['Network'],
		},
	},
};

export class HttpRequest implements INodeType {
	description: INodeTypeDescription;

	constructor() {
		this.description = {
			...baseDescription,
			version: 1,
			defaults: {
				name: 'HTTP Request',
				color: 'standard-blue',
			},
			maxInputs: 1,
			maxOutputs: 1,
			properties: [
				{
					displayName: 'Method',
					name: 'method',
					type: 'select',
					default: 'GET',
					description: 'The HTTP method to use',
					options: [
						{ name: 'GET', value: 'GET' },
						{ name: 'POST', value: 'POST' },
						{ name: 'PUT', value: 'PUT' },
						{ name: 'PATCH', value: 'PATCH' },
						{ name: 'DELETE', value: 'DELETE' },
						{ name: 'HEAD', value: 'HEAD' },
						{ name: 'OPTIONS', value: 'OPTIONS' },
					],
				},
				{
					displayName: 'URL',
					name: 'url',
					type: 'string',
					default: 'https://api.example.com',
					description: 'The URL to make the request to. Use expressions like {{ TextInput.$json.text }}',
					placeholder: 'https://api.example.com/users',
				},
				{
					displayName: 'Send Query Parameters',
					name: 'sendQuery',
					type: 'boolean',
					default: false,
					description: 'Whether to send query parameters',
				},
				{
					displayName: 'Query Parameters',
					name: 'queryParameters',
					type: 'json',
					default: {},
					description: 'Query parameters to send with the request',
					displayOptions: {
						show: {
							sendQuery: [true],
						},
					},
				},
				{
					displayName: 'Send Headers',
					name: 'sendHeaders',
					type: 'boolean',
					default: false,
					description: 'Whether to send custom headers',
				},
				{
					displayName: 'Headers',
					name: 'headers',
					type: 'json',
					default: {},
					description: 'Headers to send with the request',
					displayOptions: {
						show: {
							sendHeaders: [true],
						},
					},
				},
				{
					displayName: 'Send Body',
					name: 'sendBody',
					type: 'boolean',
					default: false,
					description: 'Whether to send a request body',
					displayOptions: {
						show: {
							method: ['POST', 'PUT', 'PATCH'],
						},
					},
				},
				{
					displayName: 'Body Content Type',
					name: 'bodyContentType',
					type: 'select',
					default: 'json',
					description: 'The content type of the body',
					options: [
						{ name: 'JSON', value: 'json' },
						{ name: 'Form-Data', value: 'formData' },
						{ name: 'Form-Urlencoded', value: 'formUrlencoded' },
						{ name: 'Raw', value: 'raw' },
					],
					displayOptions: {
						show: {
							sendBody: [true],
						},
					},
				},
				{
					displayName: 'JSON Body',
					name: 'jsonBody',
					type: 'json',
					default: {},
					description: 'JSON body to send',
					displayOptions: {
						show: {
							sendBody: [true],
							bodyContentType: ['json'],
						},
					},
				},
				{
					displayName: 'Form Data',
					name: 'formData',
					type: 'json',
					default: {},
					description: 'Form data to send as key-value pairs',
					displayOptions: {
						show: {
							sendBody: [true],
							bodyContentType: ['formData'],
						},
					},
				},
				{
					displayName: 'Form URL Encoded',
					name: 'formUrlencoded',
					type: 'json',
					default: {},
					description: 'Form URL encoded data to send',
					displayOptions: {
						show: {
							sendBody: [true],
							bodyContentType: ['formUrlencoded'],
						},
					},
				},
				{
					displayName: 'Raw Content Type',
					name: 'rawContentType',
					type: 'string',
					default: 'application/json',
					description: 'Content type for raw body',
					displayOptions: {
						show: {
							sendBody: [true],
							bodyContentType: ['raw'],
						},
					},
				},
				{
					displayName: 'Raw Body',
					name: 'rawBody',
					type: 'string',
					default: '',
					description: 'Raw body content to send',
					displayOptions: {
						show: {
							sendBody: [true],
							bodyContentType: ['raw'],
						},
					},
				},
				{
					displayName: 'Timeout (ms)',
					name: 'timeout',
					type: 'number',
					default: 30000,
					description: 'Request timeout in milliseconds',
				},
				{
					displayName: 'Include Response Headers',
					name: 'includeHeaders',
					type: 'boolean',
					default: false,
					description: 'Whether to include response headers in output',
				},
				{
					displayName: 'Never Error',
					name: 'neverError',
					type: 'boolean',
					default: false,
					description: 'Return success even if HTTP status code is not 2xx',
				},
			],
		};
	}

	async execute(context: IExecutionContext): Promise<INodeExecutionData[][]> {
		const method =
			(context.evaluatedProperties.method as string)?.toUpperCase() || 'GET';
		const url = context.evaluatedProperties.url as string;
		const timeout = (context.evaluatedProperties.timeout as number) || 30000;
		const sendQuery = context.evaluatedProperties.sendQuery as boolean;
		const sendHeaders = context.evaluatedProperties.sendHeaders as boolean;
		const sendBody = context.evaluatedProperties.sendBody as boolean;
		const includeHeaders = context.evaluatedProperties.includeHeaders as boolean;
		const neverError = context.evaluatedProperties.neverError as boolean;

		if (!url) {
			throw new Error('URL is required');
		}

		// Build URL with query parameters
		let requestUrl = url;
		if (sendQuery) {
			const queryParams = context.evaluatedProperties.queryParameters as
				| Record<string, unknown>
				| undefined;
			if (queryParams && Object.keys(queryParams).length > 0) {
				const urlObj = new URL(url);
				for (const [key, value] of Object.entries(queryParams)) {
					if (value !== undefined && value !== null) {
						if (Array.isArray(value)) {
							// Handle array parameters
							for (const item of value) {
								urlObj.searchParams.append(key, String(item));
							}
						} else {
							urlObj.searchParams.append(key, String(value));
						}
					}
				}
				requestUrl = urlObj.toString();
			}
		}

		// Build headers
		const headers: Record<string, string> = {};
		if (sendHeaders) {
			const customHeaders = context.evaluatedProperties.headers as
				| Record<string, unknown>
				| undefined;
			if (customHeaders) {
				for (const [key, value] of Object.entries(customHeaders)) {
					if (value !== undefined && value !== null) {
						headers[key] = String(value);
					}
				}
			}
		}

		// Build body
		let body: string | undefined;
		if (sendBody) {
			const bodyContentType = context.evaluatedProperties
				.bodyContentType as string;
			switch (bodyContentType) {
				case 'json': {
					const jsonBody = context.evaluatedProperties.jsonBody as
						| Record<string, unknown>
						| undefined;
					if (jsonBody !== undefined) {
						body = JSON.stringify(jsonBody);
						if (!headers['Content-Type']) {
							headers['Content-Type'] = 'application/json';
						}
					}
					break;
				}
				case 'formData': {
					const formData = context.evaluatedProperties.formData as
						| Record<string, unknown>
						| undefined;
					if (formData) {
						const formDataObj = new FormData();
						for (const [key, value] of Object.entries(formData)) {
							if (value !== undefined && value !== null) {
								if (value instanceof File || value instanceof Blob) {
									formDataObj.append(key, value);
								} else {
									formDataObj.append(key, String(value));
								}
							}
						}
						// For server-side, we'll use URLSearchParams format
						// In a real implementation, you might want to use a proper FormData library
						const params = new URLSearchParams();
						for (const [key, value] of Object.entries(formData)) {
							if (value !== undefined && value !== null) {
								params.append(key, String(value));
							}
						}
						body = params.toString();
						if (!headers['Content-Type']) {
							headers['Content-Type'] =
								'application/x-www-form-urlencoded';
						}
					}
					break;
				}
				case 'formUrlencoded': {
					const formUrlencoded = context.evaluatedProperties
						.formUrlencoded as Record<string, unknown> | undefined;
					if (formUrlencoded) {
						const params = new URLSearchParams();
						for (const [key, value] of Object.entries(formUrlencoded)) {
							if (value !== undefined && value !== null) {
								params.append(key, String(value));
							}
						}
						body = params.toString();
						if (!headers['Content-Type']) {
							headers['Content-Type'] =
								'application/x-www-form-urlencoded';
						}
					}
					break;
				}
				case 'raw': {
					const rawBody = context.evaluatedProperties.rawBody as
						| string
						| undefined;
					const rawContentType =
						(context.evaluatedProperties.rawContentType as string) ||
						'application/json';
					if (rawBody !== undefined) {
						body = rawBody;
						if (!headers['Content-Type']) {
							headers['Content-Type'] = rawContentType;
						}
					}
					break;
				}
			}
		}

		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const fetchOptions: RequestInit = {
				method,
				headers,
				signal: controller.signal,
			};

			if (body !== undefined) {
				fetchOptions.body = body;
			}

			const response = await fetch(requestUrl, fetchOptions);
			const responseText = await response.text();

			// Parse response
			let responseData: unknown = responseText;
			try {
				responseData = JSON.parse(responseText);
			} catch {
				// Keep as text if not JSON
			}

			// Check for errors unless neverError is true
			if (!neverError && !response.ok) {
				throw new Error(
					`HTTP ${response.status} ${response.statusText}: ${responseText}`,
				);
			}

			// Build output
			const output: Record<string, unknown> = {
				statusCode: response.status,
				statusText: response.statusText,
				body: responseData,
			};

			if (includeHeaders) {
				output.headers = Object.fromEntries(response.headers.entries());
			}

			return [
				[
					{
						json: output,
					},
				],
			];
		} catch (error) {
			// Handle timeout or other errors
			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error(`Request timeout after ${timeout}ms`);
				}
				if (neverError) {
					// Return error as data instead of throwing
					return [
						[
							{
								json: {
									error: error.message,
									statusCode: 0,
									statusText: 'Request Failed',
								},
							},
						],
					];
				}
				throw error;
			}
			throw new Error('Unknown error occurred during HTTP request');
		} finally {
			clearTimeout(timeoutId);
		}
	}
}

