/**
 * Protected Route Hook
 *
 * Ensures the route is only accessible to authenticated users
 */

import { useNavigate } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/api";
import { useEffect } from "react";

export function useProtectedRoute() {
	const navigate = useNavigate();

	useEffect(() => {
		if (!isAuthenticated()) {
			navigate({ to: "/login" });
		}
	}, [navigate]);
}
