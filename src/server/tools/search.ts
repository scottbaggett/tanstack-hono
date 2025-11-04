/**
 * Search Tool
 *
 * Web search tool with Zod validation
 * Example tool demonstrating async operations and timeout handling
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolName } from '@/server/types/agent';

// ============================================================================
// Schema Definitions
// ============================================================================

const searchInputSchema = z.object({
	query: z.string().min(1).max(500).describe('Search query'),
	maxResults: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(5)
		.describe('Maximum number of results to return'),
});

const searchResultSchema = z.object({
	title: z.string().describe('Result title'),
	url: z.string().url().describe('Result URL'),
	snippet: z.string().describe('Short excerpt/description'),
});

const searchOutputSchema = z.object({
	query: z.string().describe('Original search query'),
	results: z.array(searchResultSchema).describe('Search results'),
	totalResults: z.number().int().describe('Total number of results found'),
	success: z.boolean().describe('Whether search succeeded'),
	error: z.string().optional().describe('Error message if search failed'),
});

export type SearchInput = z.infer<typeof searchInputSchema>;
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;

// ============================================================================
// Mock Search Implementation
// ============================================================================

/**
 * Mock search function for demonstration
 * In production, replace with actual search API (e.g., Google Custom Search, Bing, DuckDuckGo)
 */
async function mockSearch(query: string, maxResults: number): Promise<SearchResult[]> {
	// Simulate network delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Generate mock results based on query
	const results: SearchResult[] = [];
	const count = Math.min(maxResults, 5);

	for (let i = 0; i < count; i++) {
		results.push({
			title: `${query} - Result ${i + 1}`,
			url: `https://example.com/search?q=${encodeURIComponent(query)}&result=${i + 1}`,
			snippet: `This is a mock search result for "${query}". In production, this would contain actual search result data from a search API.`,
		});
	}

	return results;
}

// ============================================================================
// Tool Implementation
// ============================================================================

export const searchTool: AgentTool<SearchInput, SearchOutput> = {
	name: 'search' as ToolName,
	description:
		'Searches the web for information. Provide a search query and optionally the maximum number of results (default: 5, max: 10). Returns titles, URLs, and snippets.',
	inputSchema: searchInputSchema,
	outputSchema: searchOutputSchema,
	timeoutMs: 5000, // 5 seconds for network requests
	maxOutputBytes: 50 * 1024, // 50KB (search results can be larger)

	async execute(ctx: ToolContext, input: SearchInput): Promise<SearchOutput> {
		ctx.emit({
			t: 'tool.start',
			tool: 'search' as ToolName,
			id: ctx.executionId,
			input,
		});

		const startTime = Date.now();

		try {
			// Check for cancellation
			if (ctx.signal.aborted) {
				throw new Error('Search cancelled');
			}

			// Perform search with timeout
			const results = await Promise.race([
				mockSearch(input.query, input.maxResults ?? 5),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Search timeout')), 4000),
				),
			]);

			// Check cancellation again after async operation
			if (ctx.signal.aborted) {
				throw new Error('Search cancelled');
			}

			const output: SearchOutput = {
				query: input.query,
				results,
				totalResults: results.length,
				success: true,
			};

			ctx.emit({
				t: 'tool.success',
				tool: 'search' as ToolName,
				id: ctx.executionId,
				size: JSON.stringify(output).length,
				ms: Date.now() - startTime,
			});

			return output;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			const output: SearchOutput = {
				query: input.query,
				results: [],
				totalResults: 0,
				success: false,
				error: errorMessage,
			};

			ctx.emit({
				t: 'tool.error',
				tool: 'search' as ToolName,
				id: ctx.executionId,
				error: {
					code: error instanceof Error && error.message.includes('timeout')
						? 'TOOL_TIMEOUT'
						: 'TOOL_UNAVAILABLE',
					message: errorMessage,
					cause: error instanceof Error ? error : undefined,
					retriable: true, // Search failures are usually retriable
				},
			});

			// Return error output (don't throw - let agent handle)
			return output;
		}
	},
};

// ============================================================================
// Production Integration Notes
// ============================================================================

/**
 * To integrate a real search API, replace mockSearch() with one of:
 *
 * 1. Google Custom Search API:
 *    - Sign up at https://developers.google.com/custom-search/v1/overview
 *    - Install: npm install googleapis
 *    - Use customsearch.cse.list()
 *
 * 2. Bing Web Search API:
 *    - Sign up at https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
 *    - Use fetch with Bing API endpoints
 *
 * 3. DuckDuckGo (unofficial):
 *    - Install: npm install duck-duck-scrape
 *    - Note: Rate-limited, no official API
 *
 * 4. SerpAPI:
 *    - Sign up at https://serpapi.com/
 *    - Aggregates multiple search engines
 *
 * Example with Google Custom Search:
 *
 * import { google } from 'googleapis';
 *
 * async function googleSearch(query: string, maxResults: number): Promise<SearchResult[]> {
 *   const customsearch = google.customsearch('v1');
 *   const res = await customsearch.cse.list({
 *     auth: process.env.GOOGLE_API_KEY,
 *     cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
 *     q: query,
 *     num: maxResults,
 *   });
 *
 *   return (res.data.items || []).map(item => ({
 *     title: item.title || '',
 *     url: item.link || '',
 *     snippet: item.snippet || '',
 *   }));
 * }
 */

// ============================================================================
// Examples
// ============================================================================

/**
 * Example usage:
 *
 * const ctx: ToolContext = { ... };
 *
 * const result = await searchTool.execute(ctx, {
 *   query: "LangGraph documentation",
 *   maxResults: 3
 * });
 *
 * // result = {
 * //   query: "LangGraph documentation",
 * //   results: [
 * //     { title: "...", url: "...", snippet: "..." },
 * //     { title: "...", url: "...", snippet: "..." },
 * //     { title: "...", url: "...", snippet: "..." }
 * //   ],
 * //   totalResults: 3,
 * //   success: true
 * // }
 */
