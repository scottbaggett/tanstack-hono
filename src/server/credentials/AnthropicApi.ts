/**
 * Anthropic API Credentials
 *
 * Authentication for Anthropic's Claude API
 */

import type {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IHttpRequestOptions,
} from "@/types/credentials";

export class AnthropicApi implements ICredentialType {
	name = "anthropicApi";
	displayName = "Anthropic API";
	documentationUrl =
		"https://docs.anthropic.com/claude/reference/authentication";
	icon = "sparkles";
	iconColor = "orange";

	properties = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string" as const,
			typeOptions: { password: true },
			required: true,
			default: "",
			placeholder: "sk-ant-...",
			description: "Your Anthropic API key from https://console.anthropic.com",
		},
		{
			displayName: "Base URL",
			name: "baseUrl",
			type: "string" as const,
			default: "https://api.anthropic.com",
			description: "Override the default base URL for the API",
		},
		{
			displayName: "Add Custom Header",
			name: "customHeader",
			type: "boolean" as const,
			default: false,
			description: "Add a custom header to requests",
		},
		{
			displayName: "Header Name",
			name: "headerName",
			type: "string" as const,
			displayOptions: {
				show: {
					customHeader: [true],
				},
			},
			default: "",
			placeholder: "X-Custom-Header",
		},
		{
			displayName: "Header Value",
			name: "headerValue",
			type: "string" as const,
			typeOptions: { password: true },
			displayOptions: {
				show: {
					customHeader: [true],
				},
			},
			default: "",
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers = requestOptions.headers || {};
		requestOptions.headers["x-api-key"] = credentials.apiKey as string;
		requestOptions.headers["anthropic-version"] = "2023-06-01";

		// Add custom header if configured
		if (
			credentials.customHeader &&
			credentials.headerName &&
			credentials.headerValue
		) {
			requestOptions.headers[credentials.headerName as string] =
				credentials.headerValue as string;
		}

		return requestOptions;
	}

	test = {
		request: {
			baseURL: "={{$credentials?.baseUrl}}",
			url: "/v1/messages",
			method: "POST",
			headers: {
				"anthropic-version": "2023-06-01",
			},
			body: {
				model: "claude-3-haiku-20240307",
				messages: [{ role: "user", content: "test" }],
				max_tokens: 1,
			},
		},
	};
}
