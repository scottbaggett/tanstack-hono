/**
 * Slack API Credentials
 *
 * Authentication for Slack's Web API
 */

import type { ICredentialType, ICredentialDataDecryptedObject, IHttpRequestOptions } from '@/types/credentials';

export class SlackApi implements ICredentialType {
	name = 'slackApi';
	displayName = 'Slack API';
	documentationUrl = 'https://api.slack.com/authentication';
	icon = 'message-square';
	iconColor = 'purple';

	properties = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string' as const,
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'xoxb-...',
			description: 'Your Slack Bot User OAuth Token from https://api.slack.com/apps',
		},
	];

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		requestOptions.headers = requestOptions.headers || {};
		requestOptions.headers['Authorization'] = `Bearer ${credentials.accessToken}`;

		return requestOptions;
	}

	test = {
		request: {
			baseURL: 'https://slack.com/api',
			url: '/auth.test',
			method: 'POST',
		},
	};
}
