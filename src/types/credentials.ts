/**
 * Credential System Types
 *
 * Based on n8n's credential architecture with encryption support
 */

// ============================================================================
// CREDENTIAL TYPE DEFINITION
// ============================================================================

/**
 * Property definition for a credential field
 */
export interface ICredentialTypeProperty {
	displayName: string;
	name: string;
	type: 'string' | 'password' | 'number' | 'boolean';
	description?: string;
	required?: boolean;
	default?: string | number | boolean;
	placeholder?: string;
	typeOptions?: {
		password?: boolean; // For password masking
	};
	displayOptions?: {
		show?: Record<string, unknown[]>; // Show this field when conditions match
		hide?: Record<string, unknown[]>; // Hide this field when conditions match
	};
}

/**
 * HTTP request options for authentication
 */
export interface IHttpRequestOptions {
	method?: string;
	url?: string;
	baseURL?: string;
	headers?: Record<string, string>;
	body?: unknown;
	qs?: Record<string, string | number | boolean>;
}

/**
 * Credential test rules for validating responses
 */
export interface IAuthenticateRuleResponseCode {
	type: 'responseCode';
	properties: {
		value: number;
		message?: string;
	};
}

export interface IAuthenticateRuleResponseSuccessBody {
	type: 'responseSuccessBody';
	properties: {
		key: string;
		value?: string | number | boolean;
		message?: string;
	};
}

/**
 * Credential test configuration
 */
export interface ICredentialTestRequest {
	request: IHttpRequestOptions;
	rules?: (IAuthenticateRuleResponseCode | IAuthenticateRuleResponseSuccessBody)[];
}

/**
 * Credential test data
 */
export interface ICredentialTestRequestData {
	nodeType?: any;
	testRequest: ICredentialTestRequest;
}

/**
 * HTTP request node configuration for credentials
 */
export type ICredentialHttpRequestNode = {
	name: string;
	docsUrl: string;
	hidden?: boolean;
} & ({ apiBaseUrl: string } | { apiBaseUrlPlaceholder: string });

/**
 * Authentication configuration for automatic header/query injection
 */
export interface ICredentialAuthentication {
	type: 'generic';
	properties: {
		headers?: Record<string, string>;
		qs?: Record<string, string>;
	};
}

/**
 * Defines the schema for a credential type (e.g., "slackApi", "httpBasicAuth")
 */
export interface ICredentialType {
	name: string; // Unique identifier (e.g., "slackApi")
	displayName: string; // User-facing name (e.g., "Slack API")
	properties: ICredentialTypeProperty[];
	extends?: string[]; // Inherit from other credential types
	__overwrittenProperties?: string[]; // Properties overridden from parent
	authenticate?: ICredentialAuthentication | ((credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions) => Promise<IHttpRequestOptions>);
	preAuthentication?: (credentials: ICredentialDataDecryptedObject) => Promise<Record<string, any>>;
	test?: ICredentialTestRequest;
	genericAuth?: boolean; // Whether this is a generic auth type
	httpRequestNode?: ICredentialHttpRequestNode; // HTTP request node integration
	supportedNodes?: string[]; // Which nodes can use this credential
	icon?: string;
	iconColor?: string;
	iconUrl?: string;
	documentationUrl?: string;
}

// ============================================================================
// CREDENTIAL INSTANCE (SAVED CREDENTIALS)
// ============================================================================

/**
 * Flexible credential information type
 */
export type CredentialInformation =
	| string
	| string[]
	| number
	| boolean
	| Record<string, any>
	| Record<string, any>[];

/**
 * Decrypted credential data (used during execution)
 */
export interface ICredentialDataDecryptedObject {
	[key: string]: CredentialInformation;
}

/**
 * Encrypted credential stored in database
 */
export interface ICredentialsEncrypted {
	id: string;
	name: string; // User's name for this credential (e.g., "My Slack Workspace")
	type: string; // References credential type (e.g., "slackApi")
	data: string; // Encrypted JSON string
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Credential data for API responses (no sensitive data)
 */
export interface ICredentialsResponse {
	id: string;
	name: string;
	type: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Credential data for creating/updating
 */
export interface ICredentialData {
	name: string;
	type: string;
	data: ICredentialDataDecryptedObject;
}

// ============================================================================
// NODE CREDENTIAL REFERENCE
// ============================================================================

/**
 * How a node references a credential (stored in workflow definition)
 */
export interface INodeCredentialsDetails {
	id: string; // Which credential instance to use
	name: string; // Display name (for UI)
}

/**
 * Credential requirements for a node type
 */
export interface INodeCredentialDescription {
	name: string; // Credential type name (e.g., "slackApi")
	required?: boolean; // Whether credential is required
	displayOptions?: {
		show?: Record<string, unknown[]>;
		hide?: Record<string, unknown[]>;
	};
}

// ============================================================================
// CREDENTIAL ACCESS INTERFACE
// ============================================================================

/**
 * Interface for nodes to access credentials during execution
 */
export interface IGetCredentials {
	get(type: string, id?: string): Promise<ICredentialDataDecryptedObject>;
}

// ============================================================================
// CREDENTIAL CLASS
// ============================================================================

/**
 * Abstract credential class for handling encryption/decryption
 */
export abstract class ICredentials<
	T extends ICredentialDataDecryptedObject = ICredentialDataDecryptedObject,
> {
	id?: string;
	name: string;
	type: string;
	data: string | undefined; // Encrypted data

	constructor(
		nodeCredentials: INodeCredentialsDetails,
		type: string,
		data?: string,
	) {
		this.id = nodeCredentials.id ?? undefined;
		this.name = nodeCredentials.name;
		this.type = type;
		this.data = data;
	}

	/**
	 * Get decrypted credential data
	 */
	abstract getData(nodeType?: string): T;

	/**
	 * Get encrypted data for storage
	 */
	abstract getDataToSave(): ICredentialsEncrypted;

	/**
	 * Set credential data (will be encrypted)
	 */
	abstract setData(data: T): void;
}
