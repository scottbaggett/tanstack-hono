/**
 * Credential Type Registry
 *
 * Central registry for all credential types
 */

import type { ICredentialType } from "@/types/credentials";
import { AnthropicApi } from "./AnthropicApi";
import { ApiKey } from "./ApiKey";
import { BearerToken } from "./BearerToken";
import { GitHubApi } from "./GitHubApi";
import { HttpBasicAuth } from "./HttpBasicAuth";
import { OpenAiApi } from "./OpenAiApi";
import { SlackApi } from "./SlackApi";

// ============================================================================
// CREDENTIAL REGISTRY
// ============================================================================

class CredentialRegistry {
	private types = new Map<string, ICredentialType>();

	constructor() {
		// Register service-specific credential types (alphabetical)
		this.register(new AnthropicApi());
		this.register(new GitHubApi());
		this.register(new OpenAiApi());
		this.register(new SlackApi());

		// Register generic credential types
		this.register(new HttpBasicAuth());
		this.register(new ApiKey());
		this.register(new BearerToken());
	}

	/**
	 * Register a credential type
	 */
	register(credentialType: ICredentialType): void {
		if (this.types.has(credentialType.name)) {
			throw new Error(
				`Credential type "${credentialType.name}" is already registered`,
			);
		}

		this.types.set(credentialType.name, credentialType);
	}

	/**
	 * Get a credential type by name
	 */
	getType(name: string): ICredentialType | undefined {
		return this.types.get(name);
	}

	/**
	 * Get all credential types
	 */
	getAllTypes(): ICredentialType[] {
		return Array.from(this.types.values());
	}

	/**
	 * Check if a credential type exists
	 */
	hasType(name: string): boolean {
		return this.types.has(name);
	}

	/**
	 * Get credential type names
	 */
	getTypeNames(): string[] {
		return Array.from(this.types.keys());
	}
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const credentialRegistry = new CredentialRegistry();
