import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		email: "",
		password: "",
		username: "",
		fullName: "",
	});

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
			const payload = isLogin
				? { email: formData.email, password: formData.password }
				: {
						email: formData.email,
						password: formData.password,
						username: formData.username,
						fullName: formData.fullName,
					};

			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await response.json();

			if (!data.success) {
				setError(data.error || "Authentication failed");
				return;
			}

			// Store token
			localStorage.setItem("token", data.data.token);
			localStorage.setItem("user", JSON.stringify(data.data.user));

			// Redirect to workflows
			navigate({ to: "/workflows" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-linear-to-br from-surface1 to-surface-4 p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>{isLogin ? "Sign In" : "Create Account"}</CardTitle>
					<CardDescription>
						{isLogin
							? "Start building your workflows"
							: "Create a new account to get started"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<Alert variant="destructive" className="mb-4">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						{!isLogin && (
							<>
								<div>
									<label className="text-sm font-medium">Username</label>
									<Input
										type="text"
										name="username"
										value={formData.username}
										onChange={handleChange}
										placeholder="johndoe"
										required={!isLogin}
									/>
								</div>
								<div>
									<label className="text-sm font-medium">Full Name</label>
									<Input
										type="text"
										name="fullName"
										value={formData.fullName}
										onChange={handleChange}
										placeholder="John Doe"
									/>
								</div>
							</>
						)}

						<div>
							<label className="text-sm font-medium">Email</label>
							<Input
								type="email"
								name="email"
								value={formData.email}
								onChange={handleChange}
								placeholder="you@example.com"
								required
							/>
						</div>

						<div>
							<label className="text-sm font-medium">Password</label>
							<Input
								type="password"
								name="password"
								value={formData.password}
								onChange={handleChange}
								placeholder="••••••••"
								required
							/>
						</div>

						<Button type="submit" className="w-full" disabled={loading} >
							{loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
						</Button>
					</form>

					<div className="mt-6 text-center">
						<p className="text-sm text-muted-foreground">
							{isLogin
								? "Don't have an account? "
								: "Already have an account? "}
							<Button
								variant="link"
								size="sm"
								onClick={() => {
									setIsLogin(!isLogin);
									setError(null);
									setFormData({
										email: "",
										password: "",
										username: "",
										fullName: "",
									});
								}}
							>
								{isLogin ? "Sign up" : "Sign in"}
							</Button>
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
