/**
 * Execution Logs Viewer Component
 *
 * Displays execution logs with filtering and search capabilities
 */

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";

interface LogEntry {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	nodeId?: string;
	source: "system" | "user_code";
}

interface ExecutionLogsViewerProps {
	workflowId: string;
	runId: string;
	nodeId?: string | null;
}

export function ExecutionLogsViewer({
	workflowId,
	runId,
	nodeId,
}: ExecutionLogsViewerProps) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [levelFilter, setLevelFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch logs
	useEffect(() => {
		async function fetchLogs() {
			setIsLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams();
				if (nodeId) params.set("nodeId", nodeId);
				if (levelFilter !== "all") params.set("level", levelFilter);
				params.set("limit", "1000");

				const response = await apiRequest<{
					logs: LogEntry[];
					total: number;
					hasMore: boolean;
				}>(`/api/workflows/${workflowId}/runs/${runId}/logs?${params.toString()}`, {
					method: "GET",
				});

				if (!response.success) {
					throw new Error(response.error || "Failed to fetch logs");
				}

				setLogs(response.data?.logs || []);
			} catch (err) {
				setError(err instanceof Error ? err : new Error("Failed to fetch logs"));
			} finally {
				setIsLoading(false);
			}
		}

		fetchLogs();
	}, [workflowId, runId, nodeId, levelFilter]);

	// Filter logs by search query
	const filteredLogs = logs.filter((log) =>
		searchQuery
			? log.message.toLowerCase().includes(searchQuery.toLowerCase())
			: true,
	);

	// Get log level color
	const getLevelColor = (level: string) => {
		switch (level) {
			case "error":
				return "text-red-600";
			case "warn":
				return "text-yellow-600";
			case "debug":
				return "text-gray-500";
			default:
				return "text-foreground";
		}
	};

	const handleCopyLogs = async () => {
		const logText = filteredLogs
			.map(
				(log) =>
					`[${format(new Date(log.timestamp), "HH:mm:ss")}] ${log.level.toUpperCase()}: ${log.message}`,
			)
			.join("\n");

		try {
			await navigator.clipboard.writeText(logText);
		} catch (err) {
			console.error("Failed to copy logs:", err);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-2">
				{[1, 2, 3, 4, 5].map((i) => (
					<Skeleton key={i} className="h-8 w-full" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<LucideIcon name="alert-circle" className="h-4 w-4" />
				<AlertDescription>
					Failed to load logs: {error.message}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Controls */}
			<div className="flex items-center gap-2 mb-4">
				<div className="flex-1">
					<Input
						type="text"
						placeholder="Search logs..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="text-sm"
					/>
				</div>
				<Select value={levelFilter} onValueChange={setLevelFilter}>
					<SelectTrigger className="w-32">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						<SelectItem value="error">Errors</SelectItem>
						<SelectItem value="warn">Warnings</SelectItem>
						<SelectItem value="info">Info</SelectItem>
						<SelectItem value="debug">Debug</SelectItem>
					</SelectContent>
				</Select>
				<Button variant="outline" size="sm" onClick={handleCopyLogs}>
					<LucideIcon name="copy" className="h-4 w-4 mr-1" />
					Copy
				</Button>
			</div>

			{/* Logs List */}
			<div className="flex-1 overflow-auto space-y-1 font-mono text-xs">
				{filteredLogs.length === 0 ? (
					<p className="text-muted-foreground text-center py-8">
						No logs available
					</p>
				) : (
					filteredLogs.map((log) => (
						<div
							key={log.id}
							className={`p-2 rounded border-b hover:bg-muted/50 ${getLevelColor(log.level)}`}
						>
							<div className="flex items-start gap-2">
								<span className="text-muted-foreground shrink-0">
									{format(new Date(log.timestamp), "HH:mm:ss.SSS")}
								</span>
								<Badge
									variant="outline"
									className={`text-xs shrink-0 ${
										log.level === "error"
											? "border-red-500 text-red-600"
											: log.level === "warn"
											? "border-yellow-500 text-yellow-600"
											: ""
									}`}
								>
									{log.level.toUpperCase()}
								</Badge>
								{log.source === "user_code" && (
									<Badge variant="secondary" className="text-xs shrink-0">
										User
									</Badge>
								)}
								<span className="flex-1 break-words">{log.message}</span>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}

