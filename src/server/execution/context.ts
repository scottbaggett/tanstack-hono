/**
 * Execution Context Builder
 *
 * Builds ExecutionContext for node execution by:
 * - Evaluating CEL expressions in node properties
 * - Gathering inputs from connected nodes
 * - Loading and decrypting credentials
 * - Preparing context with workflow state
 */

import type { ExecutionContext, INodeTypeDescription } from '@/types/interfaces';
import { evaluateProperties } from '@/server/lib/expressions';
import type { ExpressionContext } from '@/server/lib/expressions';
import type { INodeCredentialsDetails } from '@/types/credentials';
import { credentialService } from '../services/credentials';

interface ContextBuilderInput {
	nodeId: string;
	nodeType: string;
	version: number;
	nodeDescription: INodeTypeDescription;
	properties: Record<string, unknown>; // Raw properties from workflow definition
	inputs: Record<string, any>; // Values from connected input nodes
	credentials?: Record<string, INodeCredentialsDetails>; // Credential references from node
	previousData?: any[]; // Data from previous node executions in this run
	signal?: AbortSignal; // For cancellation support
}

/**
 * Build execution context with evaluated properties and credentials
 */
export async function buildExecutionContext(
	input: ContextBuilderInput,
): Promise<ExecutionContext> {
	const {
		nodeId,
		nodeType,
		version,
		properties,
		inputs,
		credentials,
		previousData,
		signal,
	} = input;

	// Build expression context with available variables
	// Extract json and binary from incoming data
	const inputData = inputs?.main?.json || inputs?.main || {};
	const binaryData = inputs?.main?.binary || {};

	const expressionContext: ExpressionContext = {
		// json: the output data from connected input node
		json: inputData,
		// binary: binary data from connected input node
		binary: binaryData,
		// input.params: parameters from connected input node
		input: {
			params: properties, // For now, expose current properties as input.params
		},
		// Current node metadata
		node: {
			id: nodeId,
			type: nodeType,
			version,
		},
		// Additional context
		previousData: previousData,
	};

	// Evaluate all properties with CEL expressions
	const evaluation = evaluateProperties(properties, expressionContext);

	if (!evaluation.success) {
		throw new Error(
			`Failed to evaluate properties for node "${nodeId}": ${evaluation.error}`,
		);
	}

	// Load and decrypt credentials
	const decryptedCredentials: Record<string, Record<string, any>> = {};

	if (credentials) {
		for (const [credentialType, credentialDetails] of Object.entries(credentials)) {
			try {
				const credentialData = await credentialService.getCredentialData(
					credentialType,
					credentialDetails.id,
				);

				if (credentialData) {
					decryptedCredentials[credentialType] = credentialData;
				} else {
					console.warn(
						`Credential "${credentialDetails.name}" (${credentialDetails.id}) not found for node "${nodeId}"`,
					);
				}
			} catch (error) {
				console.error(
					`Failed to load credential "${credentialDetails.name}" for node "${nodeId}":`,
					error,
				);
				throw new Error(
					`Failed to load credential "${credentialDetails.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
		}
	}

	// Return complete execution context
	return {
		nodeId,
		nodeType,
		version,
		inputs,
		properties,
		evaluatedProperties: evaluation.values || {},
		credentials: Object.keys(decryptedCredentials).length > 0 ? decryptedCredentials : undefined,
		previousData,
		signal,
	};
}

/**
 * Build expression context for a node
 * Useful for dynamic input computation or validation
 */
export function buildExpressionContext(
	nodeId: string,
	nodeType: string,
	version: number,
	properties: Record<string, unknown>,
	inputs: Record<string, any> = {},
): ExpressionContext {
	return {
		$input: inputs,
		// Also expose inputs directly by output name for cleaner syntax: {{ main.field }} instead of {{ $input.main.field }}
		...inputs,
		$parameter: properties,
		$node: {
			id: nodeId,
			type: nodeType,
			version,
		},
	};
}
