/**
 * Protected Route
 *
 * Wrapper for routes that require authentication.
 */

import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isAuthenticated } from "@/lib/api";

interface ProtectedRouteProps {
	children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const navigate = useNavigate();

	useEffect(() => {
		if (!isAuthenticated()) {
			navigate({ to: "/login" });
		}
	}, [navigate]);

	if (!isAuthenticated()) {
		return null;
	}

	return <>{children}</>;
}
