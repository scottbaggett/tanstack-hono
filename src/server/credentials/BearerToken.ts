/**
 * Bearer Token Credential Type
 *
 * Bearer token authentication (commonly used for OAuth 2.0)
 */

import type { ICredentialType } from '@/types/credentials';

export class BearerToken implements ICredentialType {
	name = 'bearerToken';
	displayName = 'Bearer Token';
	icon = 'shield';

	properties = [
		{
			displayName: 'Token',
			name: 'token',
			type: 'password' as const,
			required: true,
			description: 'The bearer token for authentication',
		},
	];

	authenticate = {
		type: 'generic' as const,
		properties: {
			headers: {
				Authorization: '=Bearer {{ $credentials.token }}',
			},
		},
	};
}
