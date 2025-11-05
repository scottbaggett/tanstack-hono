/**
 * Execution Header Component
 *
 * Displays execution metadata and navigation controls
 */

import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkflowRun } from "@/server/types/api";

interface ExecutionHeaderProps {
	run: WorkflowRun;
	workflowName: string;
	workflowId: string;
	onPrevious?: () => void;
	onNext?: () => void;
}

export function ExecutionHeader({
	run,
	workflowName,
	workflowId,
	onPrevious,
	onNext,
}: ExecutionHeaderProps) {
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
		statusConfig[run.status as keyof typeof statusConfig] || statusConfig.pending;

	return (
		<div className="border-b bg-background px-6 py-4">
			<div className="flex items-center justify-between">
				{/* Left: Title and Status */}
				<div className="flex items-center gap-4">
					<Link
						to="/workflow/$workflowId/executions"
						params={{ workflowId }}
						className="text-muted-foreground hover:text-foreground"
					>
						<LucideIcon name="arrow-left" className="h-5 w-5" />
					</Link>
					<div>
						<div className="flex items-center gap-2 mb-1">
							<h1 className="text-2xl font-bold">{workflowName}</h1>
							<Badge variant={config.variant} className="flex items-center gap-1">
								<LucideIcon
									name={config.icon}
									className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`}
								/>
								{config.label}
							</Badge>
						</div>
						<div className="text-sm text-muted-foreground">
							<span className="font-mono text-xs">{run.id.slice(0, 8)}...</span>
							{" • "}
							Started {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
							{run.completedAt && (
								<>
									{" • "}
									Completed{" "}
									{formatDistanceToNow(new Date(run.completedAt), {
										addSuffix: true,
									})}
								</>
							)}
							{run.totalTokensUsed && (
								<>
									{" • "}
									{run.totalTokensUsed.toLocaleString()} tokens
								</>
							)}
						</div>
						{run.errorMessage && (
							<div className="text-sm text-destructive mt-1">
								<LucideIcon name="alert-circle" className="h-3 w-3 inline mr-1" />
								{run.errorMessage}
							</div>
						)}
					</div>
				</div>

				{/* Right: Navigation and Actions */}
				<div className="flex items-center gap-2">
					{onPrevious && (
						<Button variant="outline" size="sm" onClick={onPrevious}>
							<LucideIcon name="chevron-left" className="h-4 w-4 mr-1" />
							Previous
						</Button>
					)}
					{onNext && (
						<Button variant="outline" size="sm" onClick={onNext}>
							Next
							<LucideIcon name="chevron-right" className="h-4 w-4 ml-1" />
						</Button>
					)}
					<Link
						to="/workflow/$workflowId"
						params={{ workflowId }}
					>
						<Button variant="outline" size="sm">
							<LucideIcon name="edit" className="h-4 w-4 mr-1" />
							Edit Workflow
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}

