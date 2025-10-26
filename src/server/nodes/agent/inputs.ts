/**
 * Agent Node Inputs
 *
 * Dynamic input computation based on agent configuration
 */

import type { DynamicInputContext, NodePort } from '@/types/interfaces';

export function getAgentInputs(context: DynamicInputContext): NodePort[] {
	const properties = context.properties || {};
	const hasOutputParser = properties.hasOutputParser === true;
	const needsFallback = properties.needsFallback === true;
	const promptType = properties.promptType || 'define';

	// Always required
	const inputs: NodePort[] = [
		{
			id: 'languageModel',
			displayName: 'Chat Model',
			type: 'ai_languageModel',
			required: true,
			maxConnections: 1,
			description: 'The language model to use for the agent',
		},
		{
			id: 'tools',
			displayName: 'Tools',
			type: 'ai_tool',
			required: false,
			description: 'Tools available to the agent',
		},
		{
			id: 'memory',
			displayName: 'Memory',
			type: 'ai_memory',
			required: false,
			maxConnections: 1,
			description: 'Memory/context for the agent',
		},
	];

	// Conditional: text input from previous node
	if (promptType === 'auto') {
		inputs.push({
			id: 'text',
			displayName: 'Text',
			type: 'main',
			required: false,
			description: 'Text input from previous node',
		});
	}

	// Conditional: output parser
	if (hasOutputParser) {
		inputs.push({
			id: 'outputParser',
			displayName: 'Output Parser',
			type: 'ai_outputParser',
			required: false,
			maxConnections: 1,
			description: 'Parser for structured output',
		});
	}

	// Conditional: fallback model
	if (needsFallback) {
		inputs.push({
			id: 'fallbackModel',
			displayName: 'Fallback Model',
			type: 'ai_languageModel',
			required: false,
			maxConnections: 1,
			description: 'Fallback model if main model fails',
		});
	}

	return inputs;
}
