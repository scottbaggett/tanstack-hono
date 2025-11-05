/**
 * OpenAI API Credentials
 *
 * Authentication for OpenAI's GPT API
 */

import type {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IHttpRequestOptions,
} from "@/types/credentials";

export class OpenAiApi implements ICredentialType {
	name = "openAiApi";
	displayName = "OpenAI API";
	documentationUrl =
		"https://platform.openai.com/docs/api-reference/authentication";
	icon = "bot";
	iconColor = "green";

	properties = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string" as const,
			typeOptions: { password: true },
			required: true,
			default: "",
			placeholder: "sk-proj-...",
			description:
				"Your OpenAI API key from https://platform.openai.com/api-keys",
		},
		{
			displayName: "Organization ID",
			name: "organizationId",
			type: "string" as const,
			default: "",
			placeholder: "org-...",
			description: "Optional: Your OpenAI organization ID",
		},
		{
			displayName: "Base URL",
			name: "baseUrl",
			type: "string" as const,
			default: "https://api.openai.com/v1",
			description:
				"Override the default base URL (useful for Azure OpenAI or proxies)",
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers = requestOptions.headers || {};
		requestOptions.headers.Authorization = `Bearer ${credentials.apiKey}`;

		// Add organization header if provided
		if (credentials.organizationId) {
			requestOptions.headers["OpenAI-Organization"] =
				credentials.organizationId as string;
		}

		return requestOptions;
	}

	test = {
		request: {
			baseURL: "={{$credentials?.baseUrl}}",
			url: "/models",
			method: "GET",
		},
	};
}
