/**
 * Logout Button
 *
 * Button that clears auth and redirects to login.
 */

import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { clearToken, getCurrentUser } from "@/lib/api";

export function LogoutButton() {
	const navigate = useNavigate();
	const user = getCurrentUser();

	const handleLogout = () => {
		clearToken();
		navigate({ to: "/login" });
	};

	return (
		<div className="flex items-center gap-4">
			{user && <span className="text-sm text-muted-foreground">{user.email}</span>}
			<Button variant="outline" size="sm" onClick={handleLogout}>
				Logout
			</Button>
		</div>
	);
}
