/**
 * API Key Credential Type
 *
 * Simple API key authentication via header
 */

import type { ICredentialType } from "@/types/credentials";

export class ApiKey implements ICredentialType {
	name = "apiKey";
	displayName = "API Key";
	icon = "key";

	properties = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "password" as const,
			required: true,
			description: "The API key to use for authentication",
		},
		{
			displayName: "Header Name",
			name: "headerName",
			type: "string" as const,
			required: false,
			default: "X-API-Key",
			description: "The name of the header to send the API key in",
			placeholder: "X-API-Key",
		},
	];

	authenticate = {
		type: "generic" as const,
		properties: {
			headers: {
				"={{ $credentials.headerName }}": "={{ $credentials.apiKey }}",
			},
		},
	};
}
