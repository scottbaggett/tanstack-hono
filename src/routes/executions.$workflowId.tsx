/**
 * Workflow Executions List Route
 *
 * Lists all execution runs for a workflow at /executions/:workflowId
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProtectedRoute } from "@/hooks/use-protected-route";
import { useWorkflow, useWorkflowRuns } from "@/hooks/use-workflows";

export const Route = createFileRoute("/executions/$workflowId")({
	component: ExecutionsPage,
});

function ExecutionsPage() {
	useProtectedRoute();
	const { workflowId } = Route.useParams();
	const { data: workflow, isLoading: workflowLoading } = useWorkflow(workflowId);
	const {
		data: runs,
		isLoading: runsLoading,
		error: runsError,
		refetch,
	} = useWorkflowRuns(workflowId);

	const isLoading = workflowLoading || runsLoading;

	return (
		<div className="container mx-auto py-8 px-4 max-w-7xl">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<div className="flex items-center gap-2 mb-2">
						<Link
							to="/workflow/$workflowId"
							params={{ workflowId }}
							className="text-muted-foreground hover:text-foreground"
						>
							<LucideIcon name="arrow-left" className="h-4 w-4" />
						</Link>
						<h1 className="text-4xl font-bold">
							{workflow?.name || "Workflow"} Executions
						</h1>
					</div>
					<p className="text-muted-foreground">
						View and debug all execution runs for this workflow
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={runsLoading}
					>
						<LucideIcon
							name={runsLoading ? "loader-2" : "refresh-cw"}
							className={`mr-2 h-4 w-4 ${runsLoading ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
					<Link to="/workflow/$workflowId" params={{ workflowId }}>
						<Button variant="outline" size="sm">
							<LucideIcon name="edit" className="mr-2 h-4 w-4" />
							Edit Workflow
						</Button>
					</Link>
				</div>
			</div>

			{/* Error State */}
			{runsError && (
				<Alert variant="destructive" className="mb-6">
					<LucideIcon name="alert-circle" className="h-4 w-4" />
					<AlertDescription>
						Failed to load executions:{" "}
						{runsError instanceof Error ? runsError.message : "Unknown error"}
						<Button
							variant="outline"
							size="sm"
							onClick={() => refetch()}
							className="ml-4"
						>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			)}

			{/* Loading State */}
			{isLoading && (
				<div className="space-y-4">
					{[1, 2, 3, 4, 5].map((i) => (
						<Card key={i}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<Skeleton className="h-6 w-48" />
									<Skeleton className="h-6 w-24" />
								</div>
								<Skeleton className="h-4 w-32 mt-2" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Empty State */}
			{!isLoading &&
				!runsError &&
				(!runs || runs.length === 0) && (
					<div className="text-center py-12">
						<div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
							<LucideIcon
								name="play-circle"
								className="h-12 w-12 text-muted-foreground"
							/>
						</div>
						<h3 className="text-2xl font-semibold mb-2">No executions yet</h3>
						<p className="text-muted-foreground mb-6 max-w-md mx-auto">
							Run this workflow to see execution history and debug data flow
						</p>
						<Link to="/workflow/$workflowId" params={{ workflowId }}>
							<Button size="lg">
								<LucideIcon name="edit" className="mr-2 h-4 w-4" />
								Go to Workflow Editor
							</Button>
						</Link>
					</div>
				)}

			{/* Executions List */}
			{!isLoading && !runsError && runs && runs.length > 0 && (
				<>
					<div className="flex items-center justify-between mb-4">
						<p className="text-sm text-muted-foreground">
							{runs.length} execution{runs.length !== 1 ? "s" : ""} total
						</p>
					</div>

					<div className="space-y-4">
						{runs.map((run) => (
							<Card
								key={run.id}
								className="hover:shadow-lg transition-shadow cursor-pointer"
							>
								<Link
									to="/executions/$workflowId/$runId"
									params={{ workflowId, runId: run.id }}
								>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="flex-1 min-w-0">
												<CardTitle className="flex items-center gap-2 mb-2">
													<StatusBadge status={run.status} />
													<span className="text-sm font-mono text-muted-foreground">
														{run.id.slice(0, 8)}...
													</span>
												</CardTitle>
												<CardDescription className="mt-1">
													Started{" "}
													{formatDistanceToNow(new Date(run.startedAt), {
														addSuffix: true,
													})}
													{run.completedAt && (
														<>
															{" • "}
															Completed{" "}
															{formatDistanceToNow(
																new Date(run.completedAt),
																{
																	addSuffix: true,
																},
															)}
														</>
													)}
													{run.status === "running" && (
														<span className="ml-2 text-yellow-600">
															• Running...
														</span>
													)}
												</CardDescription>
											</div>
											<Button variant="ghost" size="sm">
												<LucideIcon name="chevron-right" className="h-4 w-4" />
											</Button>
										</div>
									</CardHeader>
									<CardContent>
										<div className="flex items-center gap-4 text-sm text-muted-foreground">
											{run.totalTokensUsed && (
												<div className="flex items-center gap-1">
													<LucideIcon name="zap" className="h-4 w-4" />
													{run.totalTokensUsed.toLocaleString()} tokens
												</div>
											)}
											{run.errorMessage && (
												<div className="flex items-center gap-1 text-destructive">
													<LucideIcon name="alert-circle" className="h-4 w-4" />
													{run.errorMessage}
												</div>
											)}
										</div>
									</CardContent>
								</Link>
							</Card>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const statusConfig = {
		pending: { label: "Pending", variant: "secondary" as const, icon: "clock" },
		running: {
			label: "Running",
			variant: "default" as const,
			icon: "loader-2",
		},
		completed: {
			label: "Completed",
			variant: "default" as const,
			icon: "check-circle",
		},
		failed: {
			label: "Failed",
			variant: "destructive" as const,
			icon: "x-circle",
		},
	};

	const config =
		statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

	return (
		<Badge variant={config.variant} className="flex items-center gap-1">
			<LucideIcon
				name={config.icon}
				className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`}
			/>
			{config.label}
		</Badge>
	);
}

