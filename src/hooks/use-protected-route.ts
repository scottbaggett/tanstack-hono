/**
 * Protected Route Hook
 *
 * Ensures the route is only accessible to authenticated users
 */

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isAuthenticated } from "@/lib/api";

export function useProtectedRoute() {
	const navigate = useNavigate();

	useEffect(() => {
		if (!isAuthenticated()) {
			navigate({ to: "/login" });
		}
	}, [navigate]);
}
