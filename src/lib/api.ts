/**
 * API Client
 *
 * Helper for making authenticated API requests.
 */

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Get the stored JWT token
 */
export function getToken(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem("token");
}

/**
 * Set the JWT token
 */
export function setToken(token: string): void {
	localStorage.setItem("token", token);
}

/**
 * Clear the JWT token (logout)
 */
export function clearToken(): void {
	localStorage.removeItem("token");
	localStorage.removeItem("user");
}

/**
 * Make an API request with automatic token inclusion
 */
export async function apiRequest<T = unknown>(
	endpoint: string,
	options: RequestInit = {},
): Promise<ApiResponse<T>> {
	const token = getToken();

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...options.headers,
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	try {
		const response = await fetch(`${window.location.origin}${endpoint}`, {
			...options,
			headers,
		});

		const data = await response.json();

		if (!response.ok && data.error === "Missing authentication token") {
			// Token expired or invalid
			clearToken();
			window.location.href = "/login";
			return { success: false, error: "Authentication required" };
		}

		return data as ApiResponse<T>;
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Request failed",
		};
	}
}

/**
 * GET request
 */
export async function apiGet<T = unknown>(
	endpoint: string,
): Promise<ApiResponse<T>> {
	return apiRequest<T>(endpoint, { method: "GET" });
}

/**
 * POST request
 */
export async function apiPost<T = unknown>(
	endpoint: string,
	body?: unknown,
): Promise<ApiResponse<T>> {
	return apiRequest<T>(endpoint, {
		method: "POST",
		body: body ? JSON.stringify(body) : undefined,
	});
}

/**
 * PUT request
 */
export async function apiPut<T = unknown>(
	endpoint: string,
	body?: unknown,
): Promise<ApiResponse<T>> {
	return apiRequest<T>(endpoint, {
		method: "PUT",
		body: body ? JSON.stringify(body) : undefined,
	});
}

/**
 * DELETE request
 */
export async function apiDelete<T = unknown>(
	endpoint: string,
): Promise<ApiResponse<T>> {
	return apiRequest<T>(endpoint, { method: "DELETE" });
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser() {
	if (typeof window === "undefined") return null;
	const user = localStorage.getItem("user");
	return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
	return !!getToken();
}
