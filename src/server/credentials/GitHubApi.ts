/**
 * GitHub API Credentials
 *
 * Authentication for GitHub's REST API
 */

import type {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IHttpRequestOptions,
} from "@/types/credentials";

export class GitHubApi implements ICredentialType {
	name = "githubApi";
	displayName = "GitHub API";
	documentationUrl = "https://docs.github.com/en/authentication";
	icon = "github";
	iconColor = "standard-blue";

	properties = [
		{
			displayName: "Access Token",
			name: "accessToken",
			type: "string" as const,
			typeOptions: { password: true },
			required: true,
			default: "",
			placeholder: "ghp_...",
			description: "Your GitHub Personal Access Token or Fine-grained token",
		},
		{
			displayName: "Base URL",
			name: "baseUrl",
			type: "string" as const,
			default: "https://api.github.com",
			description: "For GitHub Enterprise, use your instance URL",
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers = requestOptions.headers || {};
		requestOptions.headers.Authorization = `Bearer ${credentials.accessToken}`;
		requestOptions.headers.Accept = "application/vnd.github+json";
		requestOptions.headers["X-GitHub-Api-Version"] = "2022-11-28";

		return requestOptions;
	}

	test = {
		request: {
			baseURL: "={{$credentials?.baseUrl}}",
			url: "/user",
			method: "GET",
		},
	};
}
