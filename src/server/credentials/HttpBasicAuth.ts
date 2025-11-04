/**
 * HTTP Basic Auth Credential Type
 *
 * Username/password authentication for HTTP requests
 */

import type { ICredentialType } from '@/types/credentials';

export class HttpBasicAuth implements ICredentialType {
	name = 'httpBasicAuth';
	displayName = 'HTTP Basic Auth';
	icon = 'lock';
	documentationUrl = 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication';

	properties = [
		{
			displayName: 'Username',
			name: 'username',
			type: 'string' as const,
			required: true,
			placeholder: 'admin',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'password' as const,
			required: true,
		},
	];

	authenticate = {
		type: 'generic' as const,
		properties: {
			headers: {
				Authorization: '=Basic {{ Buffer.from($credentials.username + ":" + $credentials.password).toString("base64") }}',
			},
		},
	};
}
